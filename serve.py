#!/usr/bin/env python3
"""Serve LEVEL UP locally: python3 serve.py [port] [--lan]

--lan also makes it reachable from other devices on the same Wi-Fi (e.g. your phone).

Like `python3 -m http.server`, but sends `Cache-Control: no-cache` so the
browser always revalidates the JavaScript modules after an update.
"""
import http.server
import os
import socket
import sys
from functools import partial


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def lan_ip():
    """Best guess at this computer's address on the local network."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))  # no packets are sent
            return s.getsockname()[0]
    except OSError:
        return None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    lan = "--lan" in sys.argv
    port = int(args[0]) if args else 5173
    root = os.path.dirname(os.path.abspath(__file__))
    host = "0.0.0.0" if lan else "127.0.0.1"
    server = http.server.ThreadingHTTPServer((host, port), partial(Handler, directory=root))
    print(f"LEVEL UP running at http://localhost:{port}  (Ctrl+C to stop)")
    if lan:
        ip = lan_ip()
        print(f"On your phone (same Wi-Fi): http://{ip or '<this-computer-ip>'}:{port}")
        print("Anyone on this Wi-Fi network can open it while this is running.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
