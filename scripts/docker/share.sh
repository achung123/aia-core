#!/bin/bash
# Makes the AIA stack reachable from phones/tablets on the LAN via:
#   - http://aia.local
#   - http://<windows-lan-ip> as a fallback
#
# WSL2 runs behind a NAT, so mDNS packets from the Avahi container never reach
# the physical Wi-Fi. This script configures Windows to bridge both the TCP
# traffic and the mDNS name onto the real LAN.
set -e

echo "Setting up LAN sharing..."

WSL_IP=$(hostname -I | awk '{print $1}')

# Discover the Windows LAN IP on the active Wi-Fi interface.
LAN_IP=$(powershell.exe -NoProfile -Command "
  (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { \$_.InterfaceAlias -like '*Wi-Fi*' -and \$_.PrefixOrigin -eq 'Dhcp' }
  ).IPAddress
" | tr -d '[:space:]\r')

if [ -z "$LAN_IP" ]; then
  echo "Could not detect a Wi-Fi LAN IP on the Windows host."
  exit 1
fi

echo "  WSL IP:     $WSL_IP"
echo "  Windows IP: $LAN_IP"
echo ""
echo "1/3 Configuring port forwarding and firewall (UAC prompt will appear)..."

# Elevated: Windows listens on port 80 and forwards traffic into WSL.
powershell.exe -NoProfile -Command "
  Start-Process -Verb RunAs -Wait -FilePath powershell.exe -ArgumentList \
    '-NoProfile','-Command',
    'netsh interface portproxy reset;
     netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=80 connectaddress=$WSL_IP connectport=80;
     netsh advfirewall firewall delete rule name=AIA-HTTP 2>\$null;
     netsh advfirewall firewall add rule name=AIA-HTTP dir=in action=allow protocol=TCP localport=80'
"

echo "2/3 Installing Python zeroconf on Windows (first time only)..."
powershell.exe -NoProfile -Command "py -3 -m pip install --user --quiet --disable-pip-version-check zeroconf" 2>&1 | grep -vE "^$" || true

echo "3/3 Starting mDNS broadcaster for aia.local..."
# Replace any previous broadcaster so only one Windows-side responder is active.
powershell.exe -NoProfile -Command "
  Get-CimInstance Win32_Process -Filter \"Name='python.exe' OR Name='pythonw.exe'\" |
    Where-Object { \$_.CommandLine -like '*aia_mdns_broadcaster*' } |
    ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }
" 2>/dev/null || true

SCRIPT_WIN_PATH=$(wslpath -w "$(cd "$(dirname "$0")" && pwd)/aia_mdns_broadcaster.py")
powershell.exe -NoProfile -Command "
  Start-Process -WindowStyle Hidden -FilePath py.exe -ArgumentList '-3','\"$SCRIPT_WIN_PATH\"','$LAN_IP'
"

echo ""
echo "Sharing active"
echo ""
echo "On any device on the same Wi-Fi:"
echo "  http://aia.local"
echo "  http://$LAN_IP  (fallback if .local resolution is unavailable)"
echo ""
echo "When done sharing, run: ./scripts/docker/unshare.sh"
