#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, parse_qs, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
SPREADSHEET_ID = "1DpSxO_ugC0tYlEdqMthc-xN8yVgiezsd2N3dIFiWQfc"
DEFAULT_SHEET = "改裝業績"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/sheet.js":
            self.send_sheet_js(parsed.query)
            return
        if parsed.path == "/api/sheet":
            self.send_sheet_csv(parsed.query)
            return
        super().do_GET()

    def send_sheet_csv(self, query):
        params = parse_qs(query)
        sheet = params.get("sheet", [DEFAULT_SHEET])[0]
        url = (
            f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq"
            f"?tqx=out:csv&sheet={quote(sheet)}"
        )
        try:
            request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urlopen(request, timeout=20) as response:
                body = response.read()
        except Exception as exc:
            message = f"Google 試算表讀取失敗：{exc}".encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(message)))
            self.end_headers()
            self.wfile.write(message)
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_sheet_js(self, query):
        params = parse_qs(query)
        callback = params.get("callback", [""])[0]
        if not callback.replace("_", "").replace("$", "").isalnum():
            self.send_response(400)
            self.end_headers()
            return

        sheet = params.get("sheet", [DEFAULT_SHEET])[0]
        url = (
            f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq"
            f"?tqx=out:csv&sheet={quote(sheet)}"
        )
        try:
            request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urlopen(request, timeout=20) as response:
                csv_text = response.read().decode("utf-8-sig")
            body = f"{callback}({csv_text!r});".encode("utf-8")
        except Exception as exc:
            body = f"{callback}('', {str(exc)!r});".encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "application/javascript; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 4173), Handler)
    print("車牌搜尋網頁：http://127.0.0.1:4173")
    server.serve_forever()
