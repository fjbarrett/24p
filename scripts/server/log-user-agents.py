#!/usr/bin/env python3
"""
Tails the nginx access log and writes each unique user-agent string to a
text file (one per line). Loads existing entries on startup so restarts
don't produce duplicates.

Usage:
    python3 log-user-agents.py

Environment variables (all optional):
    NGINX_LOG  — path to nginx access log  (default: /var/log/nginx/access.log)
    UA_LOG     — path to output file       (default: /var/log/24p-user-agents.txt)
"""

import os
import re
import sys
import time

NGINX_LOG = os.environ.get("NGINX_LOG", "/var/log/nginx/access.log")
UA_LOG    = os.environ.get("UA_LOG",    "/var/log/24p-user-agents.txt")
POLL_SECS = 2

# nginx combined log format: last quoted token is the user-agent
UA_RE = re.compile(r'"([^"]*)"$')

def parse_ua(line: str) -> str | None:
    m = UA_RE.search(line.rstrip())
    if not m:
        return None
    ua = m.group(1).strip()
    return ua if ua and ua != "-" else None

# Load already-seen UAs so we don't re-append after a restart
seen: set[str] = set()
if os.path.exists(UA_LOG):
    with open(UA_LOG, "r", encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if stripped:
                seen.add(stripped)
    print(f"[ua-log] loaded {len(seen)} existing user-agent(s) from {UA_LOG}", flush=True)

cursor = os.path.getsize(NGINX_LOG) if os.path.exists(NGINX_LOG) else 0
print(f"[ua-log] watching {NGINX_LOG} → {UA_LOG}", flush=True)

with open(UA_LOG, "a", encoding="utf-8") as out:
    while True:
        try:
            size = os.path.getsize(NGINX_LOG)
        except FileNotFoundError:
            time.sleep(POLL_SECS)
            continue

        # Detect log rotation
        if size < cursor:
            print("[ua-log] log rotation detected, resetting cursor", flush=True)
            cursor = 0

        if size > cursor:
            with open(NGINX_LOG, "r", encoding="utf-8", errors="replace") as log:
                log.seek(cursor)
                for line in log:
                    ua = parse_ua(line)
                    if ua and ua not in seen:
                        seen.add(ua)
                        out.write(ua + "\n")
                        out.flush()
            cursor = size

        time.sleep(POLL_SECS)
