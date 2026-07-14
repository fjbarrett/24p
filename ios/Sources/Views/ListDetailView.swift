import SwiftUI

@MainActor
final class ListDetailViewModel: ObservableObject {
    @Published var movies: [SimplifiedMovie] = []
    @Published var isLoading = false
    @Published var error: String?

    /// The server budgets ~120 detail requests/min per IP, so cap the burst
    /// and keep the fan-out narrow (sliding window of concurrent fetches).
    private static let maxItems = 100
    private let maxConcurrent = 8

    func load(_ list: SavedList) async {
        guard movies.isEmpty, !isLoading else { return }
        isLoading = true
        error = nil
        let items = Array(list.items.prefix(Self.maxItems))
        var resolved: [Int: SimplifiedMovie] = [:]
        await withTaskGroup(of: SimplifiedMovie?.self) { group in
            var iterator = items.makeIterator()
            for _ in 0..<maxConcurrent {
                guard let item = iterator.next() else { break }
                group.addTask {
                    try? await APIClient.shared.detail(tmdbId: item.tmdbId, mediaType: item.mediaType)
                }
            }
            for await movie in group {
                if let movie { resolved[movie.tmdbId] = movie }
                if let item = iterator.next() {
                    group.addTask {
                        try? await APIClient.shared.detail(tmdbId: item.tmdbId, mediaType: item.mediaType)
                    }
                }
            }
        }
        // Preserve the list's order even though fetches finish out of order.
        movies = items.compactMap { resolved[$0.tmdbId] }
        if movies.isEmpty && !items.isEmpty {
            // Every fetch failed (e.g. offline) — that's a load error, not an empty list.
            error = "Couldn't load this list's titles. Check your connection and try again."
        }
        isLoading = false
    }
}

struct ListDetailView: View {
    let list: SavedList

    @StateObject private var vm = ListDetailViewModel()
    private let columns = [GridItem(.adaptive(minimum: Theme.posterGridMin), spacing: Theme.gridSpacing)]

    var body: some View {
        ScrollView {
            if vm.isLoading && vm.movies.isEmpty {
                ProgressView().padding(.top, 40)
            } else if let error = vm.error, vm.movies.isEmpty {
                ContentUnavailableView {
                    Label("Couldn't load list", systemImage: "wifi.slash")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") { Task { await vm.load(list) } }
                }
                .padding(.top, 40)
            } else if vm.movies.isEmpty {
                ContentUnavailableView("Empty list", systemImage: "rectangle.stack",
                                       description: Text("This list has no titles yet."))
                    .padding(.top, 40)
            } else {
                LazyVGrid(columns: columns, spacing: 20) {
                    ForEach(vm.movies) { movie in
                        NavigationLink(value: MediaRef(tmdbId: movie.tmdbId, mediaType: movie.resolvedMediaType)) {
                            PosterCard(movie: movie)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding()

                if vm.movies.count < list.items.count {
                    Text("Showing \(vm.movies.count) of \(list.items.count) titles")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .padding(.bottom, 16)
                }
            }
        }
        .navigationTitle(list.title)
        .navigationSubtitle(subtitle)
        .task { await vm.load(list) }
    }

    private var subtitle: String {
        let n = list.items.count
        return "\(n) \(n == 1 ? "title" : "titles")" + (list.username.map { " · @\($0)" } ?? "")
    }
}
