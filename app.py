from datetime import datetime, timezone
import threading
import time

from flask import Flask, jsonify, request

from scripts.server_status import query

app = Flask(__name__)

CACHE_SECONDS = 30
_cache = None
_cache_time = 0.0
_lock = threading.Lock()

ALLOWED_ORIGINS = {
    "https://valheim.ork.ee",
    "https://www.valheim.ork.ee",
}


def get_status():
    global _cache, _cache_time

    now = time.monotonic()

    if _cache is not None and now - _cache_time < CACHE_SECONDS:
        return _cache

    with _lock:
        now = time.monotonic()

        if _cache is not None and now - _cache_time < CACHE_SECONDS:
            return _cache

        result = query()
        result["checkedAt"] = datetime.now(timezone.utc).isoformat()

        _cache = result
        _cache_time = now

        return result


@app.after_request
def add_headers(response):
    origin = request.headers.get("Origin")

    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"

    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/")
def home():
    return {
        "service": "Farlands server status",
        "status": "ok",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
    }


@app.get("/status")
def status():
    return jsonify(get_status())

ALLOWED_ORIGINS = {
    "https://valheim.ork.ee",
    "https://www.valheim.ork.ee",
    "https://valheim-ork-ee.pages.dev",
}
