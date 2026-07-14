import SwiftUI

@MainActor
final class SearchViewModel: ObservableObject {
    @Published var query = ""
    @Published var results: [SimplifiedMovie] = []
    @Published var isSearching = false
    @Published var error: String?

    private var searchTask: Task<Void, Never>?

    func search() {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else {
            results = []
            return
        }

        searchTask?.cancel()
        searchTask = Task {
            // Small debounce so we don't fire on every keystroke
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }

            isSearching = true
            error = nil
            do {
                let found = try await APIClient.shared.search(query: trimmed)
                if !Task.isCancelled { results = found }
            } catch {
                // A superseded search's cancellation must not paint an error.
                if !Task.isCancelled { self.error = error.localizedDescription }
            }
            if !Task.isCancelled { isSearching = false }
        }
    }
}

struct SearchView: View {
    @StateObject private var vm = SearchViewModel()
    @State private var selectedMovie: SimplifiedMovie?

    private let columns = [GridItem(.adaptive(minimum: 200, maximum: 240), spacing: 32)]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                TextField("Search movies & TV shows…", text: $vm.query)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 14)
                    .background(Color.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
                    .padding(.horizontal, 48)
                    .padding(.top, 48)
                    .onChange(of: vm.query) { vm.search() }

                Group {
                    if vm.isSearching {
                        ProgressView()
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if let err = vm.error {
                        ContentUnavailableView(
                            "Search failed",
                            systemImage: "magnifyingglass",
                            description: Text(err)
                        )
                    } else if vm.query.isEmpty {
                        ContentUnavailableView(
                            "Search 24p",
                            systemImage: "magnifyingglass",
                            description: Text("Type to search movies and TV shows.")
                        )
                    } else if vm.results.isEmpty {
                        ContentUnavailableView.search(text: vm.query)
                    } else {
                        resultsGrid
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .navigationTitle("Search")
            .navigationDestination(item: $selectedMovie) { movie in
                DetailView(tmdbId: movie.tmdbId, mediaType: movie.mediaType ?? "movie")
            }
        }
    }

    private var resultsGrid: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 32) {
                ForEach(vm.results) { movie in
                    Button {
                        print("[SearchView] selected movie \(movie.tmdbId) \(movie.title)")
                        selectedMovie = movie
                    } label: {
                        PosterCard(movie: movie, size: 200)
                    }
                    .buttonStyle(.card)
                }
            }
            .padding(48)
        }
    }
}
