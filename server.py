#!/usr/bin/env python3
"""
Simple HTTP server for local development
Serves the billing app with proper headers for ES6 modules
"""

import http.server
import socketserver
import os
import sys
from pathlib import Path

# Change to the directory where this script is located
os.chdir(Path(__file__).parent)

PORT = 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.getcwd(), **kwargs)

    def end_headers(self):
        # Add CORS headers for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Disable caching for development
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def guess_type(self, path):
        # Proper MIME type for ES6 modules
        if path.endswith('.js'):
            return 'application/javascript; charset=utf-8'
        if path.endswith('.mjs'):
            return 'application/javascript; charset=utf-8'
        if path.endswith('.wasm'):
            return 'application/wasm'
        return super().guess_type(path)

    def log_message(self, format, *args):
        # Suppress default log messages
        pass

def run_server(port=PORT):
    with socketserver.TCPServer(("", port), Handler) as httpd:
        print(f"Serving at http://localhost:{port}")
        print("Press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
            httpd.shutdown()

if __name__ == '__main__':
    run_server()