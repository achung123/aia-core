#!/bin/bash
powershell.exe -Command "netsh interface portproxy reset"
echo "✅ Port forwarding removed"
