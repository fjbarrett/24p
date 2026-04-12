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
    let results: [SimplifiedMovie]
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
