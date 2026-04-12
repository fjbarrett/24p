# 24p — Apple TV App

A tvOS client for the 24p film tracking webapp. Browse public lists and search movies/TV shows, with streaming provider info pulled from the same backend API.

## Setup in Xcode

1. Open Xcode → **File → New → Project**
2. Choose **tvOS → App**
3. Name: `24p-tv`, Bundle ID: `com.yourname.24p-tv`
4. Language: **Swift**, Interface: **SwiftUI**
5. Uncheck "Include Tests" (optional)
6. Save the project inside this `apple-tv/` directory

### Add source files

Delete the generated `ContentView.swift` and `<AppName>App.swift`, then drag the `Sources/` folder into the Xcode project navigator. When prompted, choose:
- ✅ Copy items if needed
- ✅ Add to target: 24p-tv

### Configure the base URL

Open `Sources/Networking/APIClient.swift` and set `kBaseURL`:

```swift
// Local dev server:
let kBaseURL = "http://localhost:3000"

// Deployed dev environment:
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
