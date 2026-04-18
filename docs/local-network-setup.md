# Local Network Setup - Native Linux/macOS vs WSL2 on Windows

This guide explains how to make All In Analytics reachable on a home LAN at
`http://aia.local`, and how that setup differs between a native Unix host and
WSL2 on Windows.

---

## Quick Decision Table

| Environment | Need `share.sh`? | What clients connect to | Why |
|---|---|---|---|
| Native Linux host | No | `http://aia.local` or the host LAN IP | No Windows NAT layer |
| Native macOS host | No | `http://aia.local` or the host LAN IP | No Windows NAT layer; Bonjour is built in |
| WSL2 on Windows | Yes, for phones/tablets on the LAN | `http://aia.local` after `./scripts/docker/share.sh` | WSL2 NAT prevents container-side mDNS from reaching the physical LAN |

On WSL2, Windows desktop browsers may still resolve `aia.local` without extra
help, but iPhone/iPad/other physical LAN clients usually cannot. The helper
scripts bridge both port 80 and the `aia.local` name onto the Windows host.

---

## How It Works

| Component | Where it runs | Purpose |
|---|---|---|
| `mdns` (`flungo/avahi`) | Docker | Advertises `aia.local` inside the host-visible Docker/WSL network |
| `proxy` (`nginx:alpine`) | Docker | Listens on port 80 and forwards traffic to `frontend:5173` |
| Backend | Docker | FastAPI API; `ALLOWED_ORIGINS` includes `http://aia.local` |
| Frontend | Docker | Vite dev server; proxies `/games`, `/players`, `/stats`, etc. to `backend:8000` |
| `scripts/docker/share.sh` | WSL2 -> Windows | Creates the Windows port proxy/firewall rule and starts a Windows-side mDNS broadcaster |
| `scripts/docker/aia_mdns_broadcaster.py` | Windows | Publishes `aia.local -> <Windows LAN IP>` on the physical LAN using Python `zeroconf` |
| `scripts/docker/unshare.sh` | WSL2 -> Windows | Removes the Windows-side bridge and stops the broadcaster |

---

## Start the Stack

```bash
# CPU build
docker compose --profile cpu up -d

# GPU build
docker compose --profile gpu up -d
```

The reverse proxy configuration is version-controlled in
`scripts/docker/proxy.conf`, so there is no manual proxy-manager UI step.

---

## Native Linux or Native macOS

If you are running the app directly on a Linux or macOS host, there is no
Windows tunneling layer.

1. Start the stack.
2. Open `http://aia.local` if your host/network is already advertising that name via Avahi/Bonjour.
3. If you do not have host-side mDNS set up, use the host LAN IP instead: `http://<host-lan-ip>`.

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
2. Prompts for Windows elevation and runs `netsh interface portproxy` so Windows listens on port 80 and forwards traffic into WSL port 80.
3. Adds a Windows Firewall rule named `AIA-HTTP` for inbound TCP port 80.
4. Installs Python `zeroconf` on the Windows side if it is missing.
5. Starts `scripts/docker/aia_mdns_broadcaster.py` as a background Windows process so phones can resolve `aia.local` to the Windows LAN IP.

After `share.sh` succeeds, LAN clients can use either:

- `http://aia.local`
- `http://<windows-lan-ip>` as a fallback

### Turn sharing off

```bash
./scripts/docker/unshare.sh
```

`unshare.sh` stops the Windows-side broadcaster, removes the `AIA-HTTP`
firewall rule, and clears the Windows port proxy configuration.

---

## Verify

From a client on the same network:

```text
http://aia.local
```

Fallback:

```text
http://<windows-lan-ip>
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

### `share.sh` says it cannot detect a Windows LAN IP

The script currently looks for an active Wi-Fi IPv4 address. If the Windows box
is on Ethernet instead, either adapt the script or use the detected Windows LAN
IP manually.

### WSL IP changed after reboot

Rerun `./scripts/docker/share.sh`. The script refreshes the Windows port proxy
to point at the new WSL IP.

### Port 80 is already in use

Something on the Docker/WSL side is already bound to port 80. Check:

```bash
sudo lsof -i :80
```

### `mdns` container exits immediately

The `flungo/avahi` image requires `network_mode: host`. Confirm your Docker
environment supports that mode.

---

## Files Added or Updated for LAN Sharing

```text
docker-compose.yml                  # mdns + nginx reverse proxy services
scripts/docker/proxy.conf           # nginx reverse-proxy config
scripts/docker/share.sh             # WSL2 -> Windows LAN bridge helper
scripts/docker/unshare.sh           # cleanup helper
scripts/docker/aia_mdns_broadcaster.py
docs/local-network-setup.md
```
