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

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/save-csv':
            import json
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                filepath = data.get('filepath', '')
                content = data.get('content', '')

                # Prevent path traversal outside current workspace directory
                target_path = Path(filepath).resolve()
                base_dir = Path(os.getcwd()).resolve()

                if not str(target_path).startswith(str(base_dir)):
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b'{"error": "Invalid path"}')
                    return

                # Ensure parent directory exists
                target_path.parent.mkdir(parents=True, exist_ok=True)
                with open(target_path, 'w', encoding='utf-8') as f:
                    f.write(content)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'filepath': str(target_path)}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

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