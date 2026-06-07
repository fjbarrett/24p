import Foundation

// MARK: - Media

struct SimplifiedMovie: Codable, Identifiable, Hashable {
    var id: Int { tmdbId }
    let tmdbId: Int
    let title: String
    let mediaType: String?
    let overview: String?
    let releaseYear: Int?
    let rating: Double?
    let imdbRating: Double?
    let posterUrl: String?
    let backdropUrl: String?
    let runtime: Int?
    let genres: [String]?
    let tagline: String?
    let imdbId: String?
    let director: PersonLink?
    let cast: [PersonLink]?

    var isTV: Bool { mediaType == "tv" }

    /// Replaces the w185 thumbnail with a larger size for tvOS display.
    func posterURL(size: String = "w342") -> URL? {
        guard let raw = posterUrl else { return nil }
        let resized = raw.replacingOccurrences(of: "/w185/", with: "/\(size)/")
        return URL(string: resized)
    }

    func backdropURL(size: String = "w780") -> URL? {
        guard let raw = backdropUrl else { return nil }
        let resized = raw.replacingOccurrences(of: "/w185/", with: "/\(size)/")
        return URL(string: resized)
    }
}

struct PersonLink: Codable, Hashable {
    let tmdbId: Int
    let name: String
    let role: String?
}

struct SearchResultItem: Codable, Hashable {
    let resultType: String
    let tmdbId: Int?
    let title: String?
    let mediaType: String?
    let overview: String?
    let releaseYear: Int?
    let rating: Double?
    let imdbRating: Double?
    let posterUrl: String?
    let backdropUrl: String?
    let runtime: Int?
    let genres: [String]?
    let tagline: String?
    let imdbId: String?
    let director: PersonLink?
    let cast: [PersonLink]?

    var movie: SimplifiedMovie? {
        guard resultType == "movie",
              let tmdbId,
              let title else {
            return nil
        }

        return SimplifiedMovie(
            tmdbId: tmdbId,
            title: title,
            mediaType: mediaType,
            overview: overview,
            releaseYear: releaseYear,
            rating: rating,
            imdbRating: imdbRating,
            posterUrl: posterUrl,
            backdropUrl: backdropUrl,
            runtime: runtime,
            genres: genres,
            tagline: tagline,
            imdbId: imdbId,
            director: director,
            cast: cast
        )
    }
}

// MARK: - Watch Providers

struct StreamingProvider: Codable, Identifiable {
    let id: Int
    let name: String
    let logoUrl: String
    let displayPriority: Int

    var logoURL: URL? { URL(string: logoUrl) }
}

struct WatchProvidersResponse: Codable {
    let providers: [StreamingProvider]
    let justWatchLink: String?
}

struct WatchLinkOffer: Codable, Identifiable, Hashable {
    var id: String { "\(providerShortName)-\(accessModel)-\(url)" }
    let url: String
    let accessModel: String
    let providerName: String
    let providerShortName: String
    let iconUrl: String?

    var iconURL: URL? {
        guard let iconUrl else { return nil }
        return URL(string: iconUrl)
    }
}

// MARK: - Session (auth)

struct SessionUser: Codable, Hashable {
    let id: String?
    let email: String
    let name: String?
    let image: String?
}

struct SessionProfile: Codable, Hashable {
    let username: String?
    let isPublic: Bool?
}

struct SessionResponse: Codable {
    let user: SessionUser
    let profile: SessionProfile?
}

struct ClaimResponse: Codable {
    let token: String
}

// MARK: - Streaming Catalog

struct StreamingCatalogMovie: Codable, Identifiable, Hashable {
    var id: String { justWatchId }
    let justWatchId: String
    let tmdbId: Int
    let imdbId: String?
    let contentType: String        // "MOVIE" | "SHOW"
    let title: String
    let releaseYear: Int?
    let overview: String?
    let posterUrl: String?
    let backdropUrls: [String]
    let primaryOfferUrl: String?
    let providerName: String
    let providerShortName: String
    let popularity: Double?
    let imdbRating: Double?
    let justWatchRating: Double?
    let chartRank: Int?

    /// Maps JustWatch content type onto the app's `mediaType` convention used by DetailView.
    var mediaType: String { contentType == "SHOW" ? "tv" : "movie" }

    /// JustWatch catalog posters are already large (`images.justwatch.com`, S718 profile),
    /// so no resize is needed — use the URL as-is.
    var posterURL: URL? {
        guard let posterUrl else { return nil }
        return URL(string: posterUrl)
    }

    /// Adapts a catalog entry to the shared `SimplifiedMovie` so it can reuse `PosterCard`.
    /// The `/w185/` swap inside `SimplifiedMovie.posterURL` is a no-op for JustWatch URLs.
    var asSimplifiedMovie: SimplifiedMovie {
        SimplifiedMovie(
            tmdbId: tmdbId,
            title: title,
            mediaType: mediaType,
            overview: overview,
            releaseYear: releaseYear,
            rating: justWatchRating,
            imdbRating: imdbRating,
            posterUrl: posterUrl,
            backdropUrl: backdropUrls.first,
            runtime: nil,
            genres: nil,
            tagline: nil,
            imdbId: imdbId,
            director: nil,
            cast: nil
        )
    }
}

struct StreamingPlatform: Codable, Identifiable, Hashable {
    var id: String { shortName }
    let packageId: Int
    let name: String
    let technicalName: String
    let shortName: String
    let iconUrl: String?
}

struct StreamingCatalogResponse: Codable {
    let movies: [StreamingCatalogMovie]
    let providers: [StreamingPlatform]
    let selectedProviders: [String]
    let sort: String
    let seed: String
    let page: Int
    let hasNextPage: Bool
}

// MARK: - Lists

struct SavedList: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let slug: String
    let color: String?
    let username: String?
    let items: [ListItem]

    struct ListItem: Codable, Hashable {
        let tmdbId: Int
        let mediaType: String
    }

    static func == (lhs: SavedList, rhs: SavedList) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

// MARK: - API Response Envelopes

struct SearchResponse: Codable {
    let combined: [SearchResultItem]

    var results: [SimplifiedMovie] {
        combined.compactMap(\.movie)
    }
}

struct MovieDetailResponse: Codable {
    let detail: SimplifiedMovie
}

struct PublicListsResponse: Codable {
    let lists: [SavedList]
}

struct ListDetailResponse: Codable {
    let list: SavedList
}
