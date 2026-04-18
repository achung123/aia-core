#!/bin/bash
# Makes the AIA stack reachable from phones/tablets on the LAN via:
#   - http://<LAN_IP>       (direct — always works if port 80 is forwarded)
#   - http://aia.local      (via Windows-side mDNS broadcaster)
#
# WSL2 runs behind a NAT, so mDNS packets from the Avahi container never reach
# the physical Wi-Fi. This script runs a zeroconf broadcaster on the Windows
# host (binding to the Wi-Fi interface) so iPhones/iPads can resolve aia.local.
set -e

echo "Setting up LAN sharing..."

WSL_IP=$(hostname -I | awk '{print $1}')

# Discover the Windows LAN IP (Wi-Fi interface)
LAN_IP=$(powershell.exe -NoProfile -Command "
  (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { \$_.InterfaceAlias -like '*Wi-Fi*' -and \$_.PrefixOrigin -eq 'Dhcp' }
  ).IPAddress
" | tr -d '[:space:]\r')

if [ -z "$LAN_IP" ]; then
  echo "❌ Could not detect a Wi-Fi LAN IP on the Windows host."
  exit 1
fi

echo "  WSL IP:     $WSL_IP"
echo "  Windows IP: $LAN_IP"
echo ""
echo "1/3 Configuring port forwarding & firewall (UAC prompt will appear)..."

# Elevated: netsh portproxy + firewall rule for port 80
powershell.exe -NoProfile -Command "
  Start-Process -Verb RunAs -Wait -FilePath powershell.exe -ArgumentList \
    '-NoProfile','-Command',
    'netsh interface portproxy reset;
     netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=80 connectaddress=$WSL_IP connectport=80;
     netsh advfirewall firewall delete rule name=AIA-HTTP 2>\$null;
     netsh advfirewall firewall add rule name=AIA-HTTP dir=in action=allow protocol=TCP localport=80'
"

echo "2/3 Installing Python zeroconf on Windows (first-time only)..."
powershell.exe -NoProfile -Command "py -3 -m pip install --user --quiet --disable-pip-version-check zeroconf" 2>&1 | grep -vE "^$" || true

echo "3/3 Starting mDNS broadcaster for aia.local..."
# Kill any previous instance
powershell.exe -NoProfile -Command "
  Get-CimInstance Win32_Process -Filter \"Name='python.exe' OR Name='pythonw.exe'\" |
    Where-Object { \$_.CommandLine -like '*aia_mdns_broadcaster*' } |
    ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }
" 2>/dev/null || true

# Convert WSL path to Windows path and launch in background (hidden)
SCRIPT_WIN_PATH=$(wslpath -w "$(cd "$(dirname "$0")" && pwd)/aia_mdns_broadcaster.py")
powershell.exe -NoProfile -Command "
  Start-Process -WindowStyle Hidden -FilePath py.exe -ArgumentList '-3','\"$SCRIPT_WIN_PATH\"','$LAN_IP'
"

echo ""
echo "✅ Sharing active"
echo ""
echo "On any device (phone, tablet, laptop) on the same Wi-Fi:"
echo ""
echo "  http://aia.local     ← works on iOS/macOS natively; Android ≥ 12; Windows w/ Bonjour"
echo "  http://$LAN_IP     ← always works"
echo ""
echo "When done sharing, run: ./scripts/docker/unshare.sh"
#!/bin/bash

echo "Setting up port forwarding..."

# Get WSL IP
WSL_IP=$(hostname -I | awk '{print $1}')

# Set up portproxy via elevated Windows PowerShell (triggers UAC prompt on Windows)
# Port 80: nginx proxy → frontend (which proxies API calls to backend)
powershell.exe -Command "
  Start-Process -Verb RunAs -Wait -FilePath powershell.exe -ArgumentList \
    '-Command \"netsh interface portproxy reset; netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=80 connectaddress=$WSL_IP connectport=80; netsh advfirewall firewall delete rule name=AIA-HTTP >$null 2>&1; netsh advfirewall firewall add rule name=AIA-HTTP dir=in action=allow protocol=TCP localport=80\"'
"

# Get Windows LAN IP
LAN_IP=$(powershell.exe -Command "
  (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { \$_.InterfaceAlias -like '*Wi-Fi*' }).IPAddress
" | tr -d '[:space:]')

echo ""
echo "✅ Port forwarding active (WSL: $WSL_IP → Windows: $LAN_IP)"
echo ""
echo "On your phone or any device on WiFi, open:"
echo ""
echo "  http://$LAN_IP"
echo ""
echo "On this desktop:"
echo ""
echo "  http://aia.local"
echo ""
echo "When done sharing, run: ./scripts/docker/unshare.sh"
echo "When done sharing, run: ./scripts/docker/unshare.sh"
