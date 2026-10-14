# Local Network Setup - Native Linux/macOS vs WSL2 on Windows

This guide explains how to make All In Analytics reachable on a home LAN at
`https://aia.local`, and how that setup differs between a native Unix host and
WSL2 on Windows.

---

## Quick Decision Table

| Environment | Need `share.sh`? | What clients connect to | Why |
|---|---|---|---|
| Native Linux host | No | `https://aia.local` | No Windows NAT layer |
| Native macOS host | No | `https://aia.local` | No Windows NAT layer; Bonjour is built in |
| WSL2 on Windows | Yes, for phones/tablets on the LAN | `https://aia.local` after `./scripts/docker/share.sh` | WSL2 NAT prevents container-side mDNS from reaching the physical LAN |

On WSL2, Windows desktop browsers may still resolve `aia.local` without extra
help, but iPhone/iPad/other physical LAN clients usually cannot. The helper
scripts bridge ports 80 and 443 plus the `aia.local` name onto the Windows
host.

One important limitation: Windows `netsh interface portproxy` does not preserve
distinct LAN client source IPs when it forwards TCP traffic into WSL. On that
shared path, nginx sees the Windows forwarder hop rather than each originating
client, so `$binary_remote_addr` rate limiting becomes a coarse per-Windows-
host guard instead of true per-client throttling. If meaningful IP-based rate
limiting matters, use the native Linux/macOS path or another ingress that
preserves source addresses.

---

## How It Works

| Component | Where it runs | Purpose |
|---|---|---|
| `mdns` (`ydkn/avahi:366`) | Docker | Advertises `aia.local` inside the host-visible Docker/WSL network via the checked-in Avahi service definition |
| `proxy` (`nginx:1.30.0-alpine`) | Docker | Bridges the `edge` and `internal` compose networks, redirects port 80 to HTTPS, terminates TLS on 443, sends app traffic to `frontend:5173`, and forwards API paths to the internal backend |
| Backend | Docker | FastAPI API on the `internal` network; `ALLOWED_ORIGINS` keeps the shared-edge browser origin on `https://aia.local`, and uvicorn trusts forwarded headers only from nginx's reserved proxy IP `172.29.0.2` |
| Frontend | Docker | Vite dev server for the SPA UI on the `edge` network |
| `scripts/docker/share.sh` | WSL2 -> Windows | Creates Windows port-proxy/firewall rules for 80/443 and starts a Windows-side mDNS broadcaster |
| `scripts/docker/aia_mdns_broadcaster.py` | Windows | Publishes `aia.local -> <Windows LAN IP>` on the physical LAN using Python `zeroconf` |
| `scripts/docker/unshare.sh` | WSL2 -> Windows | Removes the Windows-side bridge and stops the broadcaster |

Only nginx is allowed to present forwarded client metadata to uvicorn on the
shared path. The backend defaults `UVICORN_FORWARDED_ALLOW_IPS` to `172.29.0.2`
so direct clients and other containers do not get to spoof
`X-Forwarded-For`/`X-Forwarded-Proto`.

The shared compose topology keeps `proxy` on both segments, `frontend` on
`edge` only, and `backend` / `backend-gpu` on `internal` only so the SPA and
API no longer share a flat east-west network.

---

## TLS Certificate Flow

The shared compose path now expects local TLS material at these host paths:

- `scripts/docker/certs/aia.local.pem`
- `scripts/docker/certs/aia.local-key.pem`

For development on machines you control, generate them with `mkcert`:

```bash
mkdir -p scripts/docker/certs
mkcert -install
mkcert -key-file scripts/docker/certs/aia.local-key.pem -cert-file scripts/docker/certs/aia.local.pem aia.local localhost 127.0.0.1 ::1
```

If you need `https://<host-lan-ip>` as a fallback, add the current LAN IP to
the `mkcert` command and regenerate the certificate. That IP-based fallback is
fragile on DHCP-managed networks because the certificate has to be regenerated
whenever the LAN IP changes.

To avoid browser warnings on phones or tablets, install the mkcert root CA on each client device
you control before using the local certificate flow. If you
cannot install the local root on a device, the connection will still be
encrypted but the browser will treat it as untrusted; that is not a good steady
state for real play.

For a real shared deployment, replace the mkcert-mounted files with an ACME-
managed certificate pair such as Let's Encrypt `fullchain.pem` and
`privkey.pem`, and use a DNS name you control instead of `.local`.

---

## Start the Stack

Generate the local certificate first if you are using the default mkcert path.

```bash
# CPU build
docker compose --profile cpu up -d

# GPU build
docker compose --profile gpu up -d
```

The shared compose file publishes only the nginx proxy on ports 80 and 443.
Port 80 only redirects to HTTPS. If you need direct backend access with uvicorn
reload or direct Vite access for local HMR debugging, layer in the dev-only
override. It binds `127.0.0.1:8000` and `127.0.0.1:5173` on the host only:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile cpu up -d
```

If you need multiple stacks on the same host, give each one a distinct project
name:

```bash
docker compose -p aia-lab --profile cpu up -d
```

Docker Compose prefixes runtime container names with the project name
automatically, so separate stacks avoid collisions in Compose-managed runtime
names. Internal routing still uses service names such as `frontend` and
`backend`, so the checked-in proxy config and the GPU service alias keep
working unchanged. That naming does not make the whole shared stack safe to run
multiple times on one host: published host ports 80/443 and the host-network
`mdns` service are still singleton host resources unless you override those
bindings.

The reverse proxy configuration is version-controlled in
`scripts/docker/proxy.conf`, so there is no manual proxy-manager UI step.
That same file also carries the shared edge policy for browser security
headers, API request throttling, request timeouts, HTTP-to-HTTPS redirects, and
the TLS certificate paths.

### Why `mdns` still uses host networking

We evaluated publishing UDP 5353 instead of keeping `network_mode: host` on
the `mdns` service. That does not replace host networking in this stack:

1. Docker's published UDP ports forward unicast datagrams to the container, but
   mDNS depends on direct membership in the link-local multicast group at
   `224.0.0.251:5353`.
2. On native Linux and macOS, the daemon still needs host-network access to
   participate directly on the LAN multicast domain.
3. On WSL2, published UDP 5353 still does not bridge container multicast onto
   the physical LAN, so phones and tablets still rely on the Windows-side
   `aia_mdns_broadcaster.py` helper started by `share.sh`.

To keep that exception bounded, the shared compose file now pins the Avahi
image by digest, drops all Linux capabilities, adds back only `SETUID` and
`SETGID` so the daemon can switch to its unprivileged `avahi` user, sets
`no-new-privileges`, uses a read-only root filesystem, and mounts only the
checked-in service definition that advertises the AIA hostname.

---

## Native Linux or Native macOS

If you are running the app directly on a Linux or macOS host, there is no
Windows tunneling layer.

1. Start the stack.
2. Open `https://aia.local` if your host/network is already advertising that name via Avahi/Bonjour.
3. If you must use the host LAN IP directly, add that current IP to the mkcert certificate SAN list first and then use `https://<host-lan-ip>`.

`share.sh` and `unshare.sh` are WSL2-only helpers. They are not needed on a
native Linux or macOS host.

---

## WSL2 on Windows

WSL2 runs behind a NAT, so phones and tablets on your Wi-Fi cannot directly see
the `mdns` container's multicast traffic. Use the helper scripts to bridge the
app through the Windows host.

### Turn sharing on

```bash
./scripts/docker/share.sh
```

What `share.sh` does:

1. Detects the current WSL IP and the Windows LAN IP.
2. Prompts for Windows elevation and runs `netsh interface portproxy` so Windows listens on ports 80 and 443 and forwards traffic into WSL ports 80 and 443.
3. Adds Windows Firewall rules named `AIA-HTTP` and `AIA-HTTPS` for inbound TCP ports 80 and 443.
4. Installs Python `zeroconf` on the Windows side if it is missing.
5. Starts `scripts/docker/aia_mdns_broadcaster.py` as a background Windows process so phones can resolve `aia.local` to the Windows LAN IP.

After `share.sh` succeeds, LAN clients should use:

- `https://aia.local`

If you also added the current Windows LAN IP to the mkcert certificate SAN
list, then `https://<windows-lan-ip>` also works as a fallback. Without that
IP SAN, the HTTPS fallback will fail hostname validation even though the port
forwarding is correct.

This improves reachability, but it does not make the WSL2 shared path security-
equivalent to native Linux/macOS ingress for IP-based throttling because all
clients arrive at nginx through the same Windows forwarder hop.

Because Windows `portproxy` is a TCP forwarder rather than an HTTP proxy, it
does not add a trustworthy `X-Forwarded-For` header. On that path nginx still
sees the Windows hop as the client address, normalizes that value, and forwards
only that sanitized address upstream.

### Turn sharing off

```bash
./scripts/docker/unshare.sh
```

`unshare.sh` stops the Windows-side broadcaster, removes the `AIA-HTTP` and
`AIA-HTTPS` firewall rules, and clears the Windows port proxy configuration.

---

## Verify

From a client on the same network:

```text
https://aia.local
```

Fallback if the current LAN IP is included in the certificate SANs:

```text
https://<windows-lan-ip>
```

Useful checks:

```bash
# Is the proxy running?
docker compose logs proxy

# Is Avahi running inside Docker?
docker compose logs mdns

# On Windows, are the port proxy rules present?
powershell.exe -NoProfile -Command "netsh interface portproxy show all"

# On Windows, is the broadcaster process alive?
powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='python.exe' OR Name='pythonw.exe'\" | Where-Object { \$_.CommandLine -like '*aia_mdns_broadcaster*' } | Select-Object ProcessId, CommandLine | Format-List"
```

---

## Troubleshooting

### `aia.local` works on Windows desktop but not on iPhone/iPad

You are probably on WSL2 and skipped `./scripts/docker/share.sh`, or the UAC
prompt was denied. Run `share.sh` again and verify the Windows port proxy and
the background broadcaster process are present.

### HTTPS loads but the browser says the certificate is not trusted

Install the mkcert root CA on that client device and then retry. The local
certificate flow is only a clean fit for devices you control. If you cannot
install a local root CA on the client, plan on an ACME-issued certificate and a
real DNS name instead of bypassing browser warnings.

### `share.sh` says it cannot detect a Windows LAN IP

The script currently looks for an active Wi-Fi IPv4 address. If the Windows box
is on Ethernet instead, either adapt the script or use the detected Windows LAN
IP manually.

### WSL IP changed after reboot

Rerun `./scripts/docker/share.sh`. The script refreshes the Windows port proxy
to point at the new WSL IP.

### Port 80 or 443 is already in use

Something on the Docker/WSL side is already bound to one of the proxy ports.
Check:

```bash
sudo lsof -i :80 -i :443
```

### `mdns` container exits immediately

The pinned `ydkn/avahi` image still requires `network_mode: host`. Confirm your
Docker environment supports that mode and that
`scripts/docker/avahi/aia.service` is present.

---

## Files Added or Updated for LAN Sharing

```text
docker-compose.yml                  # mdns + nginx reverse proxy services
scripts/docker/proxy.conf           # nginx reverse-proxy config
scripts/docker/certs/.gitignore     # keeps local mkcert artifacts out of git
scripts/docker/avahi/aia.service    # Avahi service definition for aia.local
scripts/docker/share.sh             # WSL2 -> Windows LAN bridge helper
scripts/docker/unshare.sh           # cleanup helper
scripts/docker/aia_mdns_broadcaster.py
docs/local-network-setup.md
```
