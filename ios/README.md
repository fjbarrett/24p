# 24p — iOS

A native SwiftUI iPhone client for [24p](https://24p.mov). It talks to the same
Next.js JSON API as the web and tvOS apps; there is no app-specific backend.

## Build & run

The Xcode project is generated with [XcodeGen](https://github.com/yonsh/XcodeGen)
so signing isn't churned on every change. The `.xcodeproj` is gitignored.

```bash
cd ios
xcodegen generate
open 24p-ios.xcodeproj   # then Run, or:
xcodebuild -scheme 24p-ios -destination 'platform=iOS Simulator,name=iPhone 17' build
```

By default the app talks to production (`https://24p.mov`). Override with an
`APP_BASE_URL` scheme environment variable or an `APIBaseURL` Info.plist key.

## Architecture

```
Sources/
  App.swift                 @main app + TabView root (Home / Search / Streaming / Account)
  Models/Models.swift       Codable models matching the backend payloads exactly
  Networking/APIClient.swift Single async JSON client; attaches the bearer token
  Auth/
    Keychain.swift          Generic-password wrapper for the session token
    AuthStore.swift         PIN → bearer claim flow, session validation
  Views/
    HomeView.swift          Your Lists (signed in) + Discover public lists
    SearchView.swift        Debounced TMDB search → detail
    StreamingView.swift     JustWatch catalog: provider chips, sort, pagination
    DetailView.swift        Movie/TV detail, watch providers/links, Add-to-list sheet
    ListDetailView.swift    A list's titles (posters resolved concurrently)
    AccountView.swift       PIN sign-in / signed-in account + sign out
    Components/Components.swift  PosterCard, PosterGrid, ListRowView, color helper
```

State is plain `ObservableObject` view models with `async/await`; navigation is
value-based (`NavigationStack` + `navigationDestination`). No third-party deps.

## Auth

Reuses the existing Apple TV pairing flow — no new backend work:

1. Sign in on the web at `24p.mov`, open **Settings → Apple TV**, generate a
   4-digit PIN (`POST /api/tv/token`).
2. Enter the PIN in the **Sign In** tab. The app exchanges it for a long-lived
   bearer (`POST /api/tv/claim`) stored in the Keychain.
3. `getSessionUser` on the backend accepts `Authorization: Bearer`, so the
   authenticated routes (your lists, add-to-list, create list) work.

A future enhancement is on-device Google OAuth via `ASWebAuthenticationSession`,
which would remove the web round-trip.

## Implemented

- Browse public lists + (signed in) your own lists, open a list's titles
- Search movies / TV / people
- Streaming catalog with provider filters, popular/top-rated sort, pagination
- Title detail with metadata, cast, and watch providers/links (open in browser)
- **Add a title to a list, or create a new list** (the touch-first feature)
- PIN sign-in, session restore, sign out

## Not yet implemented

Ratings, list editing (reorder / rename / visibility) and removal, favorites,
CSV import, and an app icon / launch asset set. The list-detail view fetches
each title individually (the web app's batch endpoint isn't on `main` yet).
