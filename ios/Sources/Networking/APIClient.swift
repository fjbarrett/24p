import Foundation

enum APIEnvironment {
    /// Override at launch with the `TV_APP_BASE_URL` scheme env var or an
    /// `APIBaseURL` Info.plist key; otherwise talks to production.
    static var baseURL: String {
        if let override = ProcessInfo.processInfo.environment["APP_BASE_URL"]?
            .trimmingCharacters(in: .whitespacesAndNewlines), !override.isEmpty {
            return override
        }
        if let plist = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String {
            let trimmed = plist.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { return trimmed }
        }
        return "https://24p.mov"
    }
}

enum APIError: LocalizedError {
    case badURL
    case network(path: String, underlying: Error)
    case badStatus(path: String, code: Int, message: String?)
    case decoding(path: String, underlying: Error)

    var errorDescription: String? {
        switch self {
        case .badURL: return "Invalid URL"
        case .network(_, let error): return error.localizedDescription
        case .badStatus(_, let code, let message):
            return message ?? "Request failed (\(code))"
        case .decoding: return "Couldn't read the server response"
        }
    }

    var statusCode: Int? {
        if case .badStatus(_, let code, _) = self { return code }
        return nil
    }
}

/// Thin JSON client. `authToken`, when set, is attached as a bearer to every
/// request; public endpoints simply ignore it.
final class APIClient {
    static let shared = APIClient()

    var authToken: String?

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 45
        config.waitsForConnectivity = true
        return URLSession(configuration: config)
    }()

    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    // MARK: - Core

    private func request<T: Decodable>(
        _ method: String,
        path: String,
        query: [String: String] = [:],
        body: Encodable? = nil
    ) async throws -> T {
        var components = URLComponents(string: APIEnvironment.baseURL + path)
        if !query.isEmpty {
            components?.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components?.url else { throw APIError.badURL }

        var req = URLRequest(url: url)
        req.httpMethod = method
        if let authToken, !authToken.isEmpty {
            req.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.network(path: path, underlying: error)
        }

        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw APIError.badStatus(path: path, code: http.statusCode, message: Self.errorMessage(from: data))
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(path: path, underlying: error)
        }
    }

    private func get<T: Decodable>(_ path: String, query: [String: String] = [:]) async throws -> T {
        try await request("GET", path: path, query: query)
    }

    private static func errorMessage(from data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String? }
        return (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
    }

    // MARK: - Search / detail

    func search(query: String) async throws -> [SimplifiedMovie] {
        let result: SearchResponse = try await get("/api/tmdb/search", query: ["query": query])
        return result.results
    }

    func movieDetail(id: Int) async throws -> SimplifiedMovie {
        let result: MovieDetailResponse = try await get("/api/tmdb/movie/\(id)", query: ["lite": "true"])
        return result.detail
    }

    func tvDetail(id: Int) async throws -> SimplifiedMovie {
        let result: MovieDetailResponse = try await get("/api/tmdb/tv/\(id)")
        return result.detail
    }

    func detail(tmdbId: Int, mediaType: String) async throws -> SimplifiedMovie {
        mediaType == "tv" ? try await tvDetail(id: tmdbId) : try await movieDetail(id: tmdbId)
    }

    func watchProviders(tmdbId: Int, mediaType: String) async throws -> WatchProvidersResponse {
        try await get("/api/watch-providers", query: [
            "tmdbId": "\(tmdbId)", "mediaType": mediaType, "includeAppleTvPlus": "1",
        ])
    }

    func watchLinks(title: String, year: Int?, mediaType: String) async throws -> [WatchLinkOffer] {
        var query = ["title": title, "mediaType": mediaType]
        if let year { query["year"] = "\(year)" }
        return try await get("/api/watch-links", query: query)
    }

    // MARK: - Streaming catalog

    func streamingCatalog(
        providers: [String] = [], sort: String = "popularity", seed: String? = nil, page: Int = 1
    ) async throws -> StreamingCatalogResponse {
        var query: [String: String] = ["page": "\(page)"]
        if !providers.isEmpty { query["provider"] = providers.joined(separator: ",") }
        if sort == "rating" { query["sort"] = "rating" }
        if let seed, !seed.isEmpty { query["seed"] = seed }
        return try await get("/api/streaming", query: query)
    }

    // MARK: - Public lists

    func publicLists(limit: Int = 40) async throws -> [SavedList] {
        let result: ListsResponse = try await get("/api/lists/public", query: ["limit": "\(limit)"])
        return result.lists
    }

    func publicList(username: String, slug: String) async throws -> SavedList {
        let result: ListDetailResponse = try await get("/api/lists/public/\(username)/\(slug)")
        return result.list
    }

    // MARK: - Session / auth

    func session() async throws -> SessionResponse {
        try await get("/api/session")
    }

    func claim(pin: String) async throws -> String {
        struct Body: Encodable { let pin: String }
        let result: ClaimResponse = try await request("POST", path: "/api/tv/claim", body: Body(pin: pin))
        return result.token
    }

    // MARK: - Authenticated list management

    func myLists() async throws -> [SavedList] {
        let result: ListsResponse = try await get("/api/lists", query: ["includeShared": "true"])
        return result.lists
    }

    func addToList(listId: String, tmdbId: Int, mediaType: String) async throws -> SavedList {
        struct Body: Encodable { let tmdbId: Int; let mediaType: String }
        let result: ListDetailResponse = try await request(
            "POST", path: "/api/lists/\(listId)/items", body: Body(tmdbId: tmdbId, mediaType: mediaType))
        return result.list
    }

    func removeFromList(listId: String, tmdbId: Int) async throws -> SavedList {
        let result: ListDetailResponse = try await request("DELETE", path: "/api/lists/\(listId)/items/\(tmdbId)")
        return result.list
    }

    func createList(title: String, tmdbId: Int? = nil, mediaType: String? = nil) async throws -> SavedList {
        struct Body: Encodable { let title: String; let tmdbId: Int?; let mediaType: String? }
        let result: ListDetailResponse = try await request(
            "POST", path: "/api/lists", body: Body(title: title, tmdbId: tmdbId, mediaType: mediaType))
        return result.list
    }
}

// Lets `request` accept any Encodable body without generic plumbing.
private struct AnyEncodable: Encodable {
    private let encodeFn: (Encoder) throws -> Void
    init(_ wrapped: Encodable) { encodeFn = wrapped.encode }
    func encode(to encoder: Encoder) throws { try encodeFn(encoder) }
}
