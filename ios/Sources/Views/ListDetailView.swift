import SwiftUI

@MainActor
final class ListDetailViewModel: ObservableObject {
    @Published var movies: [SimplifiedMovie] = []
    @Published var isLoading = false

    func load(_ list: SavedList) async {
        guard movies.isEmpty else { return }
        isLoading = true
        let items = Array(list.items.prefix(60))
        var resolved: [Int: SimplifiedMovie] = [:]
        await withTaskGroup(of: SimplifiedMovie?.self) { group in
            for item in items {
                group.addTask {
                    try? await APIClient.shared.detail(tmdbId: item.tmdbId, mediaType: item.mediaType)
                }
            }
            for await movie in group {
                if let movie { resolved[movie.tmdbId] = movie }
            }
        }
        // Preserve the list's order even though fetches finish out of order.
        movies = items.compactMap { resolved[$0.tmdbId] }
        isLoading = false
    }
}

struct ListDetailView: View {
    let list: SavedList

    @StateObject private var vm = ListDetailViewModel()
    private let columns = [GridItem(.adaptive(minimum: 104), spacing: 14)]

    var body: some View {
        ScrollView {
            if vm.isLoading && vm.movies.isEmpty {
                ProgressView().padding(.top, 40)
            } else if vm.movies.isEmpty {
                ContentUnavailableView("Empty list", systemImage: "rectangle.stack",
                                       description: Text("This list has no titles yet."))
                    .padding(.top, 40)
            } else {
                LazyVGrid(columns: columns, spacing: 18) {
                    ForEach(vm.movies) { movie in
                        NavigationLink(value: MediaRef(tmdbId: movie.tmdbId, mediaType: movie.resolvedMediaType)) {
                            PosterCard(movie: movie)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding()
            }
        }
        .navigationTitle(list.title)
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.load(list) }
    }
}
