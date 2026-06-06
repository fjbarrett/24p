import Foundation

enum APIEnvironment {
    static var baseURL: String {
        if let override = ProcessInfo.processInfo.environment["TV_APP_BASE_URL"]?
            .trimmingCharacters(in: .whitespacesAndNewlines),
           !override.isEmpty {
            return override
        }

        if let plistValue = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String {
            let trimmed = plistValue.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { return trimmed }
        }

        return "https://24p.mov"
    }
}

enum APIError: LocalizedError {
    case badURL
    case networkError(path: String, underlying: Error)
    case badStatus(path: String, code: Int, body: String?)
    case decodingError(path: String, underlying: Error, body: String?)

    var errorDescription: String? {
        switch self {
        case .badURL: return "Invalid URL"
        case .networkError(let path, let error):
            return "Network error on \(path): \(error.localizedDescription)"
        case .badStatus(let path, let code, let body):
            return "HTTP \(code) on \(path)\(body.map { " — \($0)" } ?? "")"
        case .decodingError(let path, let error, let body):
            return "Decode error on \(path): \(error.localizedDescription)\(body.map { " — \($0)" } ?? "")"
        }
    }
}

final class APIClient {
    static let shared = APIClient()

    /// Bearer token for authenticated requests. Set by `AuthStore` after sign-in;
    /// attached to every request (public endpoints simply ignore it).
    var authToken: String?

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 45
        config.timeoutIntervalForResource = 60
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.waitsForConnectivity = true
        return URLSession(configuration: config)
    }()

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .useDefaultKeys
        return d
    }()

    private func get<T: Decodable>(path: String, query: [String: String] = [:]) async throws -> T {
        var components = URLComponents(string: APIEnvironment.baseURL + path)
        if !query.isEmpty {
            components?.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components?.url else { throw APIError.badURL }

        var request = URLRequest(url: url)
        request.timeoutInterval = 45
        request.cachePolicy = .reloadIgnoringLocalCacheData
        if let authToken, !authToken.isEmpty {
            request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            log("network error", path: path, detail: error.localizedDescription)
            throw APIError.networkError(path: path, underlying: error)
        }

        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            let body = responseSnippet(from: data)
            log("bad status \(http.statusCode)", path: path, detail: body)
            throw APIError.badStatus(path: path, code: http.statusCode, body: body)
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            let body = responseSnippet(from: data)
            log("decode error", path: path, detail: "\(error.localizedDescription) | \(body ?? "no body")")
            throw APIError.decodingError(path: path, underlying: error, body: body)
        }
    }

    // MARK: - Search

    func search(query: String) async throws -> [SimplifiedMovie] {
        let result: SearchResponse = try await get(path: "/api/tmdb/search", query: ["query": query])
        return result.results
    }

    // MARK: - Detail

    func movieDetail(id: Int) async throws -> SimplifiedMovie {
        let result: MovieDetailResponse = try await get(path: "/api/tmdb/movie/\(id)", query: ["lite": "true"])
        return result.detail
    }

    func tvDetail(id: Int) async throws -> SimplifiedMovie {
        let result: MovieDetailResponse = try await get(path: "/api/tmdb/tv/\(id)")
        return result.detail
    }

    // MARK: - Watch Providers

    func watchProviders(tmdbId: Int, mediaType: String) async throws -> WatchProvidersResponse {
        return try await get(path: "/api/watch-providers", query: [
            "tmdbId": "\(tmdbId)",
            "mediaType": mediaType,
            "includeAppleTvPlus": "1",
        ])
    }

    func watchLinks(title: String, year: Int?, mediaType: String) async throws -> [WatchLinkOffer] {
        var query = [
            "title": title,
            "mediaType": mediaType,
        ]
        if let year {
            query["year"] = "\(year)"
        }
        return try await get(path: "/api/watch-links", query: query)
    }

    // MARK: - Session (auth)

    /// Validates the current `authToken` and returns the signed-in user + profile.
    /// Throws `APIError.badStatus(code: 401, …)` if the token is missing/invalid.
    func session() async throws -> SessionResponse {
        try await get(path: "/api/session")
    }

    // MARK: - Streaming Catalog

    /// Fetches the public JustWatch streaming catalog. Reuse the `seed` returned by the first
    /// page on subsequent `popularity` pages to keep pagination ordering stable.
    func streamingCatalog(
        providers: [String] = [],
        sort: String = "popularity",
        seed: String? = nil,
        page: Int = 1
    ) async throws -> StreamingCatalogResponse {
        var query: [String: String] = ["page": "\(page)"]
        if !providers.isEmpty {
            query["provider"] = providers.joined(separator: ",")
        }
        if sort == "rating" {
            query["sort"] = "rating"
        }
        if let seed, !seed.isEmpty {
            query["seed"] = seed
        }
        return try await get(path: "/api/streaming", query: query)
    }

    // MARK: - Lists

    func publicLists(limit: Int = 40) async throws -> [SavedList] {
        let result: PublicListsResponse = try await get(
            path: "/api/lists/public",
            query: ["limit": "\(limit)"]
        )
        return result.lists
    }

    func listDetail(username: String, slug: String) async throws -> SavedList {
        let result: ListDetailResponse = try await get(
            path: "/api/lists/public/\(username)/\(slug)"
        )
        return result.list
    }

    private func responseSnippet(from data: Data) -> String? {
        guard !data.isEmpty else { return nil }
        let raw = String(decoding: data.prefix(400), as: UTF8.self)
        let normalized = raw.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized.isEmpty ? nil : normalized
    }

    private func log(_ message: String, path: String, detail: String?) {
        if let detail, !detail.isEmpty {
            print("[APIClient] \(message) \(path) :: \(detail)")
        } else {
            print("[APIClient] \(message) \(path)")
        }
    }
}
