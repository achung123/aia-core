#!/bin/bash

echo "Setting up port forwarding..."

# Get WSL IP
WSL_IP=$(hostname -I | awk '{print $1}')

# Set up portproxy via Windows PowerShell
powershell.exe -Command "
  netsh interface portproxy reset | Out-Null
  netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=5173 connectaddress=$WSL_IP connectport=5173
  netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=8000 connectaddress=$WSL_IP connectport=8000
"

# Get Windows LAN IP
LAN_IP=$(powershell.exe -Command "
  (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { \$_.InterfaceAlias -like '*Wi-Fi*' }).IPAddress
" | tr -d '[:space:]')

echo ""
echo "✅ Port forwarding active"
echo ""
echo "Share this URL with anyone on your WiFi:"
echo ""
echo "  http://$LAN_IP:5173"
echo ""
echo "When done sharing, run: ./unshare.sh"
