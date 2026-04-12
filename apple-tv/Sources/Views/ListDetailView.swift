import SwiftUI

@MainActor
final class ListDetailViewModel: ObservableObject {
    @Published var list: SavedList
    @Published var movies: [SimplifiedMovie] = []
    @Published var isLoading = false
    @Published var error: String?

    init(username: String, slug: String, initialList: SavedList) {
        self.list = initialList
    }

    func load(username: String, slug: String) async {
        isLoading = true
        error = nil
        do {
            let fetched = try await APIClient.shared.listDetail(username: username, slug: slug)
            list = fetched
            // Fetch movie details in parallel, capped to avoid overwhelming the API
            let ids = fetched.items.prefix(50)
            let results = await withTaskGroup(of: SimplifiedMovie?.self) { group in
                for item in ids {
                    group.addTask {
                        try? await item.mediaType == "tv"
                            ? APIClient.shared.tvDetail(id: item.tmdbId)
                            : APIClient.shared.movieDetail(id: item.tmdbId)
                    }
                }
                var out: [SimplifiedMovie] = []
                for await result in group {
                    if let m = result { out.append(m) }
                }
                return out
            }
            // Restore original list order
            let lookup = Dictionary(uniqueKeysWithValues: results.map { ($0.tmdbId, $0) })
            movies = ids.compactMap { lookup[$0.tmdbId] }
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

struct ListDetailView: View {
    let username: String
    let slug: String
    let initialList: SavedList

    @StateObject private var vm: ListDetailViewModel

    private let columns = [GridItem(.adaptive(minimum: 180, maximum: 220), spacing: 28)]

    init(username: String, slug: String, initialList: SavedList) {
        self.username = username
        self.slug = slug
        self.initialList = initialList
        _vm = StateObject(wrappedValue: ListDetailViewModel(
            username: username,
            slug: slug,
            initialList: initialList
        ))
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
        .task { await vm.load(username: username, slug: slug) }
    }
}
