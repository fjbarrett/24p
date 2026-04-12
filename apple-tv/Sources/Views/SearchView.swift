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
                results = try await APIClient.shared.search(query: trimmed)
            } catch is CancellationError {
                // Ignored — superseded by a newer query
            } catch {
                self.error = error.localizedDescription
            }
            isSearching = false
        }
    }
}

struct SearchView: View {
    @StateObject private var vm = SearchViewModel()

    private let columns = [GridItem(.adaptive(minimum: 200, maximum: 240), spacing: 32)]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                TextField("Search movies & TV shows…", text: $vm.query)
                    .textFieldStyle(.roundedBorder)
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
        }
    }

    private var resultsGrid: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 32) {
                ForEach(vm.results) { movie in
                    NavigationLink {
                        DetailView(tmdbId: movie.tmdbId, mediaType: movie.mediaType ?? "movie")
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
