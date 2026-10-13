"""
mDNS broadcaster for 'aia.local' — runs on the Windows host.

WSL2 NAT isolates containers from the physical LAN, so mDNS packets broadcast
by the Avahi container never reach phones/tablets on Wi-Fi. This script runs
directly on Windows and publishes 'aia.local -> <LAN_IP>' on the physical
Wi-Fi interface where iOS/Android devices can see it.

Usage:
    py -3 aia_mdns_broadcaster.py <LAN_IP>
"""

import signal
import socket
import sys
import time

from zeroconf import IPVersion, ServiceInfo, Zeroconf


def main() -> int:
    if len(sys.argv) != 2:
        print('Usage: aia_mdns_broadcaster.py <LAN_IP>', file=sys.stderr)
        return 1

    lan_ip = sys.argv[1]
    zc = Zeroconf(ip_version=IPVersion.V4Only, interfaces=[lan_ip])

    # Registering a service also publishes an A-record for the 'server' hostname.
    info = ServiceInfo(
        type_='_http._tcp.local.',
        name='aia._http._tcp.local.',
        addresses=[socket.inet_aton(lan_ip)],
        port=80,
        server='aia.local.',
        properties={'desc': 'All In Analytics'},
    )
    zc.register_service(info)
    print(f'Broadcasting aia.local -> {lan_ip} (Ctrl+C to stop)', flush=True)

    stop = False

    def _shutdown(signum, frame):
        nonlocal stop
        stop = True

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    try:
        while not stop:
            time.sleep(1)
    finally:
        zc.unregister_service(info)
        zc.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
