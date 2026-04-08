# Run as Administrator to start All In Analytics with LAN access.
# Usage: Right-click start.ps1 -> "Run with PowerShell as Administrator"
#   or:  PowerShell -ExecutionPolicy Bypass -File start.ps1

#Requires -RunAsAdministrator

$ports = @(5173, 8000)

# Forward LAN traffic on each port through to WSL via localhost
foreach ($port in $ports) {
    netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 2>$null
    netsh interface portproxy add    v4tov4 listenport=$port listenaddress=0.0.0.0 connectport=$port connectaddress=127.0.0.1
    netsh advfirewall firewall delete rule name="AIA Port $port" 2>$null
    netsh advfirewall firewall add    rule name="AIA Port $port" dir=in action=allow protocol=TCP localport=$port
}

Write-Host ""
Write-Host "Port forwarding active. Share this URL with devices on your WiFi:"
$ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*" | Select-Object -First 1).IPAddress
Write-Host "  http://${ip}:5173" -ForegroundColor Green
Write-Host ""

# Launch docker compose in WSL
wsl --cd /root/aia-core docker compose up
