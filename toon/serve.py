"""手绘峡谷本地服务器：和 python -m http.server 一样，但禁止浏览器缓存，改完代码刷新即生效。

用法（在仓库根目录或 toon 目录都可以）：
    python toon/serve.py
然后打开 http://127.0.0.1:8196/toon/
"""
import http.server
import os
import socketserver

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8196


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()


if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('127.0.0.1', PORT), NoCacheHandler) as httpd:
        print(f'手绘峡谷：http://127.0.0.1:{PORT}/toon/  （Ctrl+C 退出）')
        httpd.serve_forever()
