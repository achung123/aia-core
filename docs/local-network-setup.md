# Local Network Setup — WSL NAT + mDNS + Nginx Proxy Manager

This guide explains how to make All In Analytics reachable at **http://aia.local** from any device on your LAN (phone, tablet, laptop) when you are running Docker inside WSL 2 with NAT networking.

---

## How It Works

| Component | Image | Purpose |
|---|---|---|
| **Avahi mDNS** | `flungo/avahi` | Broadcasts `aia.local` on your LAN so devices can find the WSL host without knowing its IP |
| **Nginx Proxy Manager (NPM)** | `jc21/nginx-proxy-manager` | Listens on port 80 and routes `http://aia.local` → frontend / backend |
| **Backend** | local build | FastAPI API, now also accepts requests from `http://aia.local` via `ALLOWED_ORIGINS` |
| **Frontend** | local build | Vite dev server; its built-in proxy forwards `/games`, `/players`, etc. to the backend |

---

## Prerequisites

- WSL 2 with Docker Desktop (or Docker Engine inside WSL)
- Windows host with mDNS responder — **Bonjour** (installed automatically with iTunes, or via the standalone [Bonjour Print Services](https://support.apple.com/kb/DL999) installer) enables `*.local` resolution on Windows; modern Windows versions support it natively
- iOS / Android devices resolve `.local` natively (no extra setup needed)

---

## Step 1 — Port-forward from Windows Host to WSL

WSL 2 runs behind a virtual NAT. Devices on your LAN hit your **Windows IP**, so you must forward ports 80 and 81 from Windows into WSL.

Open **PowerShell as Administrator** on Windows:

```powershell
# Replace <WSL_IP> with the output of:  wsl hostname -I | awk '{print $1}'
$wslIp = (wsl hostname -I).Split(' ')[0].Trim()

# Forward port 80 (HTTP / aia.local traffic)
netsh interface portproxy add v4tov4 listenport=80  listenaddress=0.0.0.0 connectport=80  connectaddress=$wslIp

# Forward port 81 (NPM admin UI — optional, localhost-only is fine)
netsh interface portproxy add v4tov4 listenport=81  listenaddress=0.0.0.0 connectport=81  connectaddress=$wslIp

# Allow inbound on port 80 through Windows Firewall
New-NetFirewallRule -DisplayName "AIA Local HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
```

To remove these rules later:

```powershell
netsh interface portproxy delete v4tov4 listenport=80 listenaddress=0.0.0.0
netsh interface portproxy delete v4tov4 listenport=81 listenaddress=0.0.0.0
```

> **Note:** WSL 2 gets a new IP on every restart. Consider adding the `netsh` commands to a startup script, or use [WSL mirror networking mode](https://learn.microsoft.com/en-us/windows/wsl/networking#mirrored-mode-networking) (Windows 11 22H2+) which removes the need for port forwarding entirely.

---

## Step 2 — Start the Stack

```bash
# CPU build (default)
docker compose --profile cpu up -d

# GPU build
docker compose --profile gpu up -d
```

The `mdns` container starts broadcasting `aia.local` on your LAN immediately. The `proxy` container starts the NPM reverse proxy on port 80.

---

## Step 3 — Configure Nginx Proxy Manager

NPM is configured through its web UI — proxy rules are persisted in `./npm_data/` and survive restarts.

1. Open **http://localhost:81** in your browser
2. Log in with the default credentials:
   - Email: `admin@example.com`
   - Password: `changeme`
3. Change the password when prompted
4. Go to **Proxy Hosts → Add Proxy Host**

### Proxy Host — Frontend

| Field | Value |
|---|---|
| Domain Names | `aia.local` |
| Scheme | `http` |
| Forward Hostname / IP | `frontend` |
| Forward Port | `5173` |
| Block Common Exploits | ✅ |

Click **Save**.

That's it — the Vite dev server already proxies all `/games`, `/players`, `/stats`, `/upload`, and `/images` requests to the backend internally, so a single proxy-host entry is enough.

> **Optional:** If you want to expose the backend API directly (e.g. `http://aia.local/api`), add a second proxy host with a custom location or use NPM's **Custom Locations** tab to route `/games → backend:8000`, etc.

---

## Step 4 — Verify

From any device on the same Wi-Fi network:

```
http://aia.local
```

- **Android / iOS:** resolves `aia.local` natively via mDNS — no extra setup
- **Windows:** requires Bonjour or Windows mDNS (see Prerequisites)
- **macOS / Linux:** resolves `.local` natively via mDNS

If the page doesn't load, check:

```bash
# Is avahi broadcasting?
docker compose logs mdns

# Is NPM running?
docker compose logs proxy

# Are port forwards active on Windows?
netsh interface portproxy show all
```

---

## Troubleshooting

### `aia.local` doesn't resolve on Windows

Install [Bonjour Print Services](https://support.apple.com/kb/DL999) or enable the "Function Discovery Resource Publication" and "Function Discovery Provider Host" services in `services.msc`.

### Port 80 already in use

Something on the WSL host (or a previous container) is using port 80. Find and stop it:

```bash
sudo lsof -i :80
```

### WSL IP changed after reboot

Re-run the `netsh interface portproxy` commands from Step 1 with the updated IP. Alternatively, create a scheduled task in Windows to run the commands at startup.

### `mdns` container exits immediately

The `flungo/avahi` image requires `network_mode: host`. Confirm that Docker Desktop has host networking enabled (**Settings → General → Use the WSL 2 based engine** should be on). On some Docker Desktop versions you may need to enable **"Allow the default Docker socket to be used"**.

---

## File Layout Added by This Feature

```
docker-compose.yml   ← mdns + proxy services added; ALLOWED_ORIGINS updated
npm_data/            ← NPM runtime data (gitignored, created on first run)
npm_letsencrypt/     ← NPM cert storage (gitignored, created on first run)
docs/local-network-setup.md   ← this file
```
