import SwiftUI

@MainActor
final class SearchViewModel: ObservableObject {
    @Published var results: [SimplifiedMovie] = []
    @Published var isSearching = false
    @Published var error: String?

    private var task: Task<Void, Never>?

    func search(_ query: String) {
        task?.cancel()
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else {
            results = []
            isSearching = false
            return
        }
        task = Task {
            try? await Task.sleep(for: .milliseconds(300))
            if Task.isCancelled { return }
            isSearching = true
            error = nil
            do {
                let found = try await APIClient.shared.search(query: trimmed)
                if !Task.isCancelled { results = found }
            } catch {
                if !Task.isCancelled { self.error = error.localizedDescription }
            }
            if !Task.isCancelled { isSearching = false }
        }
    }
}

struct SearchView: View {
    @StateObject private var vm = SearchViewModel()
    @State private var query = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                if vm.isSearching && vm.results.isEmpty {
                    ProgressView().padding(.top, 60)
                } else if !query.isEmpty && vm.results.isEmpty && !vm.isSearching {
                    ContentUnavailableView.search(text: query)
                } else if vm.results.isEmpty {
                    ContentUnavailableView(
                        "Search 24p", systemImage: "magnifyingglass",
                        description: Text("Find movies, shows, and people."))
                } else {
                    PosterGrid(movies: vm.results).padding()
                }
            }
            .navigationTitle("Search")
            .navigationDestination(for: MediaRef.self) { DetailView(tmdbId: $0.tmdbId, mediaType: $0.mediaType) }
        }
        .searchable(text: $query, prompt: "Movies, shows, people")
        .onChange(of: query) { _, newValue in vm.search(newValue) }
    }
}
