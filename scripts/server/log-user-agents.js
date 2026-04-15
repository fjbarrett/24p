#!/usr/bin/env node
// Tails the nginx access log and writes each unique user-agent string to a
// text file (one per line). Loads existing entries on startup so restarts
// don't produce duplicates.
//
// Usage:
//   node log-user-agents.js
//
// Environment variables (all optional):
//   NGINX_LOG  — path to nginx access log  (default: /var/log/nginx/access.log)
//   UA_LOG     — path to output file       (default: /var/log/24p-user-agents.txt)

"use strict";

const fs = require("fs");

const NGINX_LOG = process.env.NGINX_LOG || "/var/log/nginx/access.log";
const UA_LOG    = process.env.UA_LOG    || "/var/log/24p-user-agents.txt";

// nginx combined log format ends with: "referer" "user-agent"
// The UA is the last double-quoted token on the line.
function parseUserAgent(line) {
  const match = line.match(/"([^"]*)"$/);
  if (!match) return null;
  const ua = match[1].trim();
  return ua && ua !== "-" ? ua : null;
}

// --- Bootstrap: load already-seen UAs so we don't re-append after a restart ---
const seen = new Set();
if (fs.existsSync(UA_LOG)) {
  const lines = fs.readFileSync(UA_LOG, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) seen.add(trimmed);
  }
  console.log(`[ua-log] loaded ${seen.size} existing user-agent(s) from ${UA_LOG}`);
}

const outStream = fs.createWriteStream(UA_LOG, { flags: "a" });

// --- Tail logic: read only bytes we haven't seen yet ---
let cursor = fs.existsSync(NGINX_LOG) ? fs.statSync(NGINX_LOG).size : 0;

function processNewBytes() {
  if (!fs.existsSync(NGINX_LOG)) return;
  const { size } = fs.statSync(NGINX_LOG);

  // Detect log rotation (file shrank)
  if (size < cursor) {
    console.log("[ua-log] log rotation detected, resetting cursor");
    cursor = 0;
  }

  if (size === cursor) return;

  const fd = fs.openSync(NGINX_LOG, "r");
  const buf = Buffer.alloc(size - cursor);
  fs.readSync(fd, buf, 0, buf.length, cursor);
  fs.closeSync(fd);
  cursor = size;

  for (const line of buf.toString("utf8").split("\n")) {
    const ua = parseUserAgent(line);
    if (ua && !seen.has(ua)) {
      seen.add(ua);
      outStream.write(ua + "\n");
    }
  }
}

// --- Watch for writes; fall back to polling every 5 s for robustness ---
try {
  fs.watch(NGINX_LOG, { persistent: true }, (event) => {
    if (event === "change") processNewBytes();
  });
  console.log(`[ua-log] watching ${NGINX_LOG}`);
} catch (err) {
  console.warn(`[ua-log] fs.watch unavailable (${err.message}), using poll-only mode`);
}

setInterval(processNewBytes, 5000);

console.log(`[ua-log] writing unique user-agents to ${UA_LOG}`);
