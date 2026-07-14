import SwiftUI

@MainActor
final class ListDetailViewModel: ObservableObject {
    @Published var list: SavedList
    @Published var movies: [SimplifiedMovie] = []
    @Published var isLoading = false
    @Published var error: String?
    /// The server budgets ~120 detail requests/min per IP, so cap the burst
    /// and keep the fan-out narrow instead of fetching whole lists at once.
    private let maxItems = 100
    private let maxConcurrentFetches = 8
    /// Owned lists are private to the user and already carry their items, so we
    /// load titles straight from `list.items` instead of the public endpoint.
    private let owned: Bool

    init(initialList: SavedList, owned: Bool) {
        self.list = initialList
        self.owned = owned
    }

    func load() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        do {
            let ids: [SavedList.ListItem]
            if owned {
                ids = list.items
            } else if let username = list.username {
                let fetched = try await APIClient.shared.listDetail(username: username, slug: list.slug)
                list = fetched
                ids = fetched.items
            } else {
                ids = list.items
            }

            let capped = Array(ids.prefix(maxItems))
            let maxConcurrent = maxConcurrentFetches
            // Sliding window: at most `maxConcurrent` detail requests in flight.
            let resolved = await withTaskGroup(of: SimplifiedMovie?.self) { group in
                var out: [Int: SimplifiedMovie] = [:]
                var iterator = capped.makeIterator()
                for _ in 0..<maxConcurrent {
                    guard let item = iterator.next() else { break }
                    group.addTask { await Self.fetchDetail(for: item) }
                }
                for await movie in group {
                    if let movie { out[movie.tmdbId] = movie }
                    if let item = iterator.next() {
                        group.addTask { await Self.fetchDetail(for: item) }
                    }
                }
                return out
            }
            movies = capped.compactMap { resolved[$0.tmdbId] }
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private nonisolated static func fetchDetail(for item: SavedList.ListItem) async -> SimplifiedMovie? {
        try? await item.mediaType == "tv"
            ? APIClient.shared.tvDetail(id: item.tmdbId)
            : APIClient.shared.movieDetail(id: item.tmdbId)
    }
}

struct ListDetailView: View {
    let list: SavedList
    let owned: Bool

    @StateObject private var vm: ListDetailViewModel

    private let columns = [GridItem(.adaptive(minimum: 180, maximum: 220), spacing: 28)]

    init(list: SavedList, owned: Bool = false) {
        self.list = list
        self.owned = owned
        _vm = StateObject(wrappedValue: ListDetailViewModel(initialList: list, owned: owned))
    }

    var body: some View {
        Group {
            if vm.isLoading {
                ProgressView("Loading list…")
            } else if let err = vm.error {
                ContentUnavailableView(
                    "Couldn't load list",
                    systemImage: "exclamationmark.triangle",
                    description: Text(err)
                )
                .overlay(alignment: .bottom) {
                    Button("Retry") {
                        Task { await vm.load() }
                    }
                    .buttonStyle(.borderedProminent)
                    .padding(.bottom, 64)
                }
            } else if vm.movies.isEmpty {
                ContentUnavailableView(
                    "Empty list",
                    systemImage: "list.bullet",
                    description: Text("This list has no titles yet.")
                )
            } else {
                ScrollView {
                    LazyVGrid(columns: columns, spacing: 28) {
                        ForEach(vm.movies) { movie in
                            NavigationLink {
                                DetailView(
                                    tmdbId: movie.tmdbId,
                                    mediaType: movie.mediaType ?? "movie"
                                )
                            } label: {
                                PosterCard(movie: movie, size: 180)
                            }
                            .buttonStyle(.card)
                        }
                    }
                    .padding(48)
                }
            }
        }
        .navigationTitle(vm.list.title)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await vm.load() }
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
            }
        }
        .task { await vm.load() }
    }
}
