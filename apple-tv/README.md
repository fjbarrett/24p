# 24p — Apple TV App

A tvOS client for the 24p film tracking webapp. Browse public lists and search movies/TV shows, with streaming provider info pulled from the same backend API.

## Build

The Xcode project is generated from `project.yml` with [XcodeGen](https://github.com/yonsm/XcodeGen) (the `.xcodeproj` is git-ignored). From this `apple-tv/` directory:

```sh
brew install xcodegen   # once
xcodegen generate       # regenerate 24p-tv.xcodeproj after pulling or editing project.yml
open 24p-tv.xcodeproj
```

The signing team is pinned in `project.yml` (`DEVELOPMENT_TEAM`) so regeneration doesn't reset it.

### Configure the base URL

Open `Sources/Networking/APIClient.swift` and set `kBaseURL`:

```swift
// Local dev server:
let kBaseURL = "http://localhost:3000"

// Deployed app:
let kBaseURL = "https://24p.mov"
```

### Run

Select the **Apple TV Simulator** (or a real Apple TV) and press **Run** (⌘R).

## Screens

| Screen | Description |
|--------|-------------|
| Home | Grid of all public lists |
| Search | Live TMDB search (movies + TV) |
| Detail | Backdrop, overview, cast/director, streaming providers |
| List detail | Poster grid for a specific list |

## API endpoints used

All requests go to the 24p Next.js backend — no auth required:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/tmdb/search?query=` | Search movies & TV |
| `GET /api/tmdb/movie/:id` | Movie detail + credits |
| `GET /api/tmdb/tv/:id` | TV show detail |
| `GET /api/watch-providers?tmdbId=&mediaType=` | Streaming providers |
| `GET /api/lists/public` | All public lists |
| `GET /api/lists/public/:username/:slug` | Single list detail |

## Requirements

- Xcode 16+
- tvOS 17+ deployment target
- Swift 5.9+
