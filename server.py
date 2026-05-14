from __future__ import annotations

import json
import mimetypes
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from hsk_card_generator.api import handle_dataset, handle_datasets, handle_enrich, handle_export, handle_export_status, handle_preview


ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "web"


class Handler(BaseHTTPRequestHandler):
    server_version = "HSKCardGenerator/0.1"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/export/") and parsed.path.endswith("/download"):
            job_id = parsed.path.split("/")[-2]
            self._download_export(job_id)
            return
        if parsed.path.startswith("/api/export/"):
            job_id = parsed.path.rsplit("/", 1)[-1]
            self._json(handle_export_status(job_id))
            return
        if parsed.path == "/api/datasets":
            self._json(handle_datasets())
            return
        if parsed.path.startswith("/api/dataset/"):
            dataset_id = parsed.path.rsplit("/", 1)[-1]
            self._json(handle_dataset(dataset_id))
            return

        target = WEB_ROOT / "index.html" if parsed.path in ("", "/") else WEB_ROOT / parsed.path.lstrip("/")
        try:
            target = target.resolve()
            target.relative_to(WEB_ROOT.resolve())
        except ValueError:
            self.send_error(403)
            return

        if not target.exists() or not target.is_file():
            self.send_error(404)
            return

        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as exc:
            self._json({"ok": False, "error": f"Invalid JSON: {exc}"}, status=400)
            return

        parsed = urlparse(self.path)
        if parsed.path == "/api/layout/preview":
            self._json(handle_preview(payload))
        elif parsed.path == "/api/enrich":
            self._json(handle_enrich(payload))
        elif parsed.path == "/api/export":
            self._json(handle_export(payload))
        else:
            self.send_error(404)

    def log_message(self, format: str, *args: object) -> None:
        sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))

    def _json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _download_export(self, job_id: str) -> None:
        zip_path = ROOT / "exports" / job_id / "hsk-card-generator-export.zip"
        try:
            resolved = zip_path.resolve()
            resolved.relative_to((ROOT / "exports").resolve())
        except ValueError:
            self.send_error(403)
            return
        if not resolved.exists():
            self.send_error(404)
            return
        data = resolved.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Disposition", 'attachment; filename="hsk-card-generator-export.zip"')
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"HSK Card Generator running at http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
