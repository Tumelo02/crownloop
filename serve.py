"""
Tiny static server for phone testing:  python serve.py [folder] [port]
Defaults: folder "dist" (run `npm run build` first; falls back to the project folder), port 8000.
Unlike `python -m http.server` it gzips text files (a third of the bytes over a tunnel or mobile
data), tells browsers not to cache while you iterate, and listens on every network interface.
"""
import functools
import gzip
import http.server
import os
import sys

folder = sys.argv[1] if len(sys.argv) > 1 else ('dist' if os.path.isdir('dist') else '.')
port = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
COMPRESSIBLE = ('.html', '.js', '.css', '.json', '.svg', '.txt')
cache = {}  # path -> (mtime, gzipped bytes)


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass

    def send_head(self):
        path = self.translate_path(self.path)
        accepts = 'gzip' in self.headers.get('Accept-Encoding', '')
        if not (accepts and os.path.isfile(path) and path.endswith(COMPRESSIBLE)):
            return super().send_head()
        mtime = os.path.getmtime(path)
        hit = cache.get(path)
        if not hit or hit[0] != mtime:
            with open(path, 'rb') as f:
                hit = (mtime, gzip.compress(f.read(), 6))
            cache[path] = hit
        self.send_response(200)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Encoding', 'gzip')
        self.send_header('Content-Length', str(len(hit[1])))
        self.end_headers()
        import io
        return io.BytesIO(hit[1])


server = http.server.ThreadingHTTPServer(('0.0.0.0', port), functools.partial(Handler, directory=folder))
server.daemon_threads = True
print(f'Serving "{folder}" on http://0.0.0.0:{port}  (Ctrl+C to stop)')
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
