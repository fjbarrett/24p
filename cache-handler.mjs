// Next's default incremental cache persists every `fetch(..., { next: { revalidate } })`
// response to .next/cache/fetch-cache, one file per key, and never evicts from
// disk. Our keys are request-derived (search queries plus a Wikipedia lookup
// per result, URL slugs, titles, JustWatch offsets per provider combo), so the
// directory grew to ~2M files / 21 GB in three weeks and ran the host out of
// inodes. The cache is recreated with the container on every deploy anyway, so
// disk persistence bought little.
//
// This is Next's own cache with disk writes switched off: fetch entries live
// only in its size-capped in-memory LRU (`cacheMaxMemorySize`), while
// build-time prerendered routes are still read from .next as before.
// createRequire keeps CJS interop identical under Node and Bun (the Docker
// build runs `next build` under Bun).
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { default: FileSystemCache } = require("next/dist/server/lib/incremental-cache/file-system-cache");

export default class MemoryOnlyCache extends FileSystemCache {
  constructor(ctx) {
    super({ ...ctx, flushToDisk: false });
  }
}
