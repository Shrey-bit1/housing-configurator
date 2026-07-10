#!/usr/bin/env python3
"""
Render an HTML file to PDF via headless Chrome + the DevTools Protocol.

Why this exists: the repo has no pandoc / wkhtmltopdf / puppeteer, but Chrome is
installed. Chrome's `--print-to-pdf` CLI flag cannot produce styled, page-numbered
footers; the DevTools `Page.printToPDF` command can. So this drives Chrome over a
CDP WebSocket (implemented with the Python standard library only — no third-party
deps) to get a professional print with running footer + "page X / Y".

Usage:
    python build-pdf.py <input.html> <output.pdf> ["footer left text"]

Regenerates docs/rules-reference.pdf from docs/rules-reference.html. See the
regeneration note in CLAUDE.md.
"""
import base64
import hashlib
import json
import os
import socket
import struct
import subprocess
import sys
import tempfile
import time
import urllib.request

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]
PORT = 9333


def find_chrome():
    for p in CHROME_CANDIDATES:
        if os.path.exists(p):
            return p
    sys.exit("No Chrome/Edge found in the usual install locations.")


# ---- minimal CDP WebSocket client (stdlib only) ----------------------------

def ws_connect(url):
    # url like ws://127.0.0.1:9333/devtools/page/<id>
    assert url.startswith("ws://")
    hostport, path = url[5:].split("/", 1)
    path = "/" + path
    host, port = hostport.split(":")
    sock = socket.create_connection((host, int(port)))
    key = base64.b64encode(os.urandom(16)).decode()
    req = (
        f"GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\n"
        "Upgrade: websocket\r\nConnection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
    )
    sock.sendall(req.encode())
    buf = b""
    while b"\r\n\r\n" not in buf:
        buf += sock.recv(4096)
    return sock


def ws_send(sock, obj):
    payload = json.dumps(obj).encode("utf-8")
    header = bytearray([0x81])  # FIN + text
    n = len(payload)
    if n < 126:
        header.append(0x80 | n)
    elif n < 65536:
        header.append(0x80 | 126)
        header += struct.pack(">H", n)
    else:
        header.append(0x80 | 127)
        header += struct.pack(">Q", n)
    mask = os.urandom(4)
    header += mask
    masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
    sock.sendall(bytes(header) + masked)


class Reader:
    def __init__(self, sock):
        self.sock = sock
        self.buf = b""

    def _need(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(1 << 16)
            if not chunk:
                raise ConnectionError("socket closed")
            self.buf += chunk

    def message(self):
        frags = b""
        while True:
            self._need(2)
            b0, b1 = self.buf[0], self.buf[1]
            fin = b0 & 0x80
            opcode = b0 & 0x0F
            masked = b1 & 0x80
            length = b1 & 0x7F
            idx = 2
            if length == 126:
                self._need(4)
                length = struct.unpack(">H", self.buf[2:4])[0]
                idx = 4
            elif length == 127:
                self._need(10)
                length = struct.unpack(">Q", self.buf[2:10])[0]
                idx = 10
            mask = b""
            if masked:
                self._need(idx + 4)
                mask = self.buf[idx:idx + 4]
                idx += 4
            self._need(idx + length)
            payload = self.buf[idx:idx + length]
            self.buf = self.buf[idx + length:]
            if masked:
                payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
            if opcode == 0x8:
                raise ConnectionError("server closed")
            if opcode in (0x9, 0xA):  # ping/pong
                continue
            frags += payload
            if fin:
                return json.loads(frags.decode("utf-8"))


def wait_response(reader, want_id, timeout=60):
    end = time.time() + timeout
    while time.time() < end:
        msg = reader.message()
        if msg.get("id") == want_id:
            if "error" in msg:
                raise RuntimeError(msg["error"])
            return msg["result"]
    raise TimeoutError(f"no response for id {want_id}")


def render(html_path, pdf_path, footer_left):
    chrome = find_chrome()
    # Keep the throwaway Chrome profile OUT of the repo (system temp, not beside the PDF).
    profile = os.path.join(tempfile.gettempdir(), "rules-pdf-chrome-profile")
    file_url = "file:///" + os.path.abspath(html_path).replace("\\", "/")
    proc = subprocess.Popen([
        chrome, "--headless=new", "--disable-gpu", "--no-first-run",
        "--no-default-browser-check", f"--remote-debugging-port={PORT}",
        f"--user-data-dir={profile}", file_url,
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        # Wait for the debugging endpoint + a page target.
        ws_url = None
        end = time.time() + 30
        while time.time() < end:
            try:
                data = urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json", timeout=1).read()
                for t in json.loads(data):
                    if t.get("type") == "page" and t.get("webSocketDebuggerUrl"):
                        ws_url = t["webSocketDebuggerUrl"]
                        break
                if ws_url:
                    break
            except Exception:
                pass
            time.sleep(0.3)
        if not ws_url:
            raise RuntimeError("Chrome DevTools endpoint never came up")

        sock = ws_connect(ws_url)
        reader = Reader(sock)
        ws_send(sock, {"id": 1, "method": "Page.enable"})
        wait_response(reader, 1)
        # Reload to be sure the document is fully laid out, then wait for load.
        ws_send(sock, {"id": 2, "method": "Page.navigate", "params": {"url": file_url}})
        wait_response(reader, 2)
        time.sleep(1.2)

        footer = (
            "<div style='font-size:8px;color:#9a938a;width:100%;margin:0 14mm;"
            "display:flex;justify-content:space-between;font-family:sans-serif;'>"
            f"<span>{footer_left}</span>"
            "<span><span class='pageNumber'></span>&nbsp;/&nbsp;<span class='totalPages'></span></span>"
            "</div>"
        )
        ws_send(sock, {"id": 3, "method": "Page.printToPDF", "params": {
            "landscape": False,
            "printBackground": True,
            "paperWidth": 8.27, "paperHeight": 11.69,       # A4
            "marginTop": 0.62, "marginBottom": 0.62,
            "marginLeft": 0.72, "marginRight": 0.72,
            "displayHeaderFooter": True,
            "headerTemplate": "<span></span>",
            "footerTemplate": footer,
            "preferCSSPageSize": False,
        }})
        result = wait_response(reader, 3, timeout=120)
        with open(pdf_path, "wb") as f:
            f.write(base64.b64decode(result["data"]))
        sock.close()
        print(f"Wrote {pdf_path} ({os.path.getsize(pdf_path)} bytes)")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    footer_text = sys.argv[3] if len(sys.argv) > 3 else "Validation Rules Reference"
    render(sys.argv[1], sys.argv[2], footer_text)
