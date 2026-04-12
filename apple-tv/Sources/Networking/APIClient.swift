import Foundation

// Set this to your deployed URL. For local dev, use "http://localhost:3000".
let kBaseURL = "https://24p.mov"

enum APIError: LocalizedError {
    case badURL
    case networkError(Error)
    case badStatus(Int)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .badURL: return "Invalid URL"
        case .networkError(let e): return e.localizedDescription
        case .badStatus(let code): return "Server returned \(code)"
        case .decodingError(let e): return "Decode error: \(e.localizedDescription)"
        }
    }
}

final class APIClient {
    static let shared = APIClient()

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        return URLSession(configuration: config)
    }()

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .useDefaultKeys
        return d
    }()

    private func get<T: Decodable>(path: String, query: [String: String] = [:]) async throws -> T {
        var components = URLComponents(string: kBaseURL + path)
        if !query.isEmpty {
            components?.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components?.url else { throw APIError.badURL }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(from: url)
        } catch {
            throw APIError.networkError(error)
        }

        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw APIError.badStatus(http.statusCode)
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    // MARK: - Search

    func search(query: String) async throws -> [SimplifiedMovie] {
        let result: SearchResponse = try await get(path: "/api/tmdb/search", query: ["query": query])
        return result.results
    }

    // MARK: - Detail

    func movieDetail(id: Int) async throws -> SimplifiedMovie {
        let result: MovieDetailResponse = try await get(path: "/api/tmdb/movie/\(id)")
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
}
