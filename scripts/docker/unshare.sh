#!/bin/bash
# Stops LAN sharing: removes the Windows-side mDNS broadcaster, port proxy,
# and firewall rule created by share.sh.
set -e

echo "1/2 Stopping mDNS broadcaster..."
powershell.exe -NoProfile -Command "
  Get-CimInstance Win32_Process -Filter \"Name='python.exe' OR Name='pythonw.exe'\" |
    Where-Object { \$_.CommandLine -like '*aia_mdns_broadcaster*' } |
    ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }
" 2>/dev/null || true

echo "2/2 Removing port forwarding and firewall rule (UAC prompt will appear)..."
powershell.exe -NoProfile -Command "
  Start-Process -Verb RunAs -Wait -FilePath powershell.exe -ArgumentList \
    '-NoProfile','-Command',
    'netsh interface portproxy reset;
     netsh advfirewall firewall delete rule name=AIA-HTTP 2>\$null'
"

echo ""
echo "Sharing stopped"
