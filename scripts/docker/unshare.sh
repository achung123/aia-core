#!/bin/bash
# Stops LAN sharing: removes port forwarding and mDNS broadcaster on the Windows host.
set -e

echo "1/2 Stopping mDNS broadcaster..."
powershell.exe -NoProfile -Command "
  Get-CimInstance Win32_Process -Filter \"Name='python.exe' OR Name='pythonw.exe'\" |
    Where-Object { \$_.CommandLine -like '*aia_mdns_broadcaster*' } |
    ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }
" 2>/dev/null || true

echo "2/2 Removing port forwarding & firewall rule (UAC prompt will appear)..."
powershell.exe -NoProfile -Command "
  Start-Process -Verb RunAs -Wait -FilePath powershell.exe -ArgumentList \
    '-NoProfile','-Command',
    'netsh interface portproxy reset;
     netsh advfirewall firewall delete rule name=AIA-HTTP 2>\$null'
"

echo ""
echo "✅ Sharing stopped"
#!/bin/bash
powershell.exe -Command "Start-Process -Verb RunAs -Wait -FilePath powershell.exe -ArgumentList '-Command \"netsh interface portproxy reset\"'"
echo "✅ Port forwarding removed"
