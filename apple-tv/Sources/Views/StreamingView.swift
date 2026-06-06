import SwiftUI

@MainActor
final class StreamingViewModel: ObservableObject {
    @Published var movies: [StreamingCatalogMovie] = []
    @Published var providers: [StreamingPlatform] = []
    @Published var selectedProvider: String?   // shortName; nil == "All"
    @Published var sort: String = "popularity"
    @Published var isLoading = false           // initial / filter-change load
    @Published var isLoadingMore = false
    @Published var error: String?

    private var seed: String?
    private var page = 1
    private var hasNextPage = false
    /// Bumped on every reset so in-flight "load more" responses for a stale filter are discarded.
    private var generation = 0

    var sortLabel: String { sort == "rating" ? "Top Rated" : "Popular" }

    /// Initial load (no-op if we already have data, so tab revisits don't reset scroll).
    func loadIfNeeded() async {
        guard movies.isEmpty, !isLoading else { return }
        await reload()
    }

    /// Resets to page 1 and reloads — used on first load and whenever a filter or sort changes.
    func reload() async {
        generation += 1
        let token = generation
        page = 1
        seed = nil
        hasNextPage = false
        isLoading = true
        error = nil

        do {
            let response = try await fetch(page: 1)
            guard token == generation else { return }
            movies = response.movies
            if providers.isEmpty { providers = response.providers }
            seed = response.seed
            hasNextPage = response.hasNextPage
        } catch {
            guard token == generation else { return }
            self.error = error.localizedDescription
        }
        if token == generation { isLoading = false }
    }

    func loadMoreIfNeeded(after movie: StreamingCatalogMovie) async {
        guard hasNextPage, !isLoadingMore, !isLoading else { return }
        // Trigger when the user nears the end of the current page.
        guard let index = movies.firstIndex(of: movie),
              index >= movies.count - 6 else { return }

        let token = generation
        isLoadingMore = true
        defer { if token == generation { isLoadingMore = false } }

        do {
            let next = page + 1
            let response = try await fetch(page: next)
            guard token == generation else { return }
            // De-dupe in case the catalog shifts between pages.
            let existing = Set(movies.map(\.id))
            movies.append(contentsOf: response.movies.filter { !existing.contains($0.id) })
            page = next
            hasNextPage = response.hasNextPage
        } catch {
            // Soft-fail pagination; keep what we have and allow a later retry.
        }
    }

    func selectProvider(_ shortName: String?) {
        guard selectedProvider != shortName else { return }
        selectedProvider = shortName
        Task { await reload() }
    }

    func setSort(_ newSort: String) {
        guard sort != newSort else { return }
        sort = newSort
        Task { await reload() }
    }

    private func fetch(page: Int) async throws -> StreamingCatalogResponse {
        try await APIClient.shared.streamingCatalog(
            providers: selectedProvider.map { [$0] } ?? [],
            sort: sort,
            seed: seed,
            page: page
        )
    }
}

struct StreamingView: View {
    @StateObject private var vm = StreamingViewModel()
    @State private var selectedMovie: StreamingCatalogMovie?

    private let columns = [GridItem(.adaptive(minimum: 200, maximum: 240), spacing: 32)]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                filterBar

                Group {
                    if vm.isLoading {
                        ProgressView("Loading streaming…")
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if let err = vm.error {
                        ContentUnavailableView(
                            "Couldn't load streaming",
                            systemImage: "exclamationmark.triangle",
                            description: Text(err)
                        )
                        .overlay(alignment: .bottom) {
                            Button("Retry") { Task { await vm.reload() } }
                                .buttonStyle(.borderedProminent)
                                .padding(.bottom, 64)
                        }
                    } else if vm.movies.isEmpty {
                        ContentUnavailableView(
                            "Nothing streaming",
                            systemImage: "play.tv",
                            description: Text("No titles match this filter.")
                        )
                    } else {
                        resultsGrid
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .navigationTitle("Streaming")
            .navigationDestination(item: $selectedMovie) { movie in
                DetailView(tmdbId: movie.tmdbId, mediaType: movie.mediaType)
            }
        }
        .task { await vm.loadIfNeeded() }
    }

    // MARK: - Filter bar

    private var filterBar: some View {
        VStack(alignment: .leading, spacing: 16) {
            Picker("Sort", selection: sortBinding) {
                Text("Popular").tag("popularity")
                Text("Top Rated").tag("rating")
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 480)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 16) {
                    providerChip(title: "All", isSelected: vm.selectedProvider == nil) {
                        vm.selectProvider(nil)
                    }
                    ForEach(vm.providers) { provider in
                        providerChip(
                            title: provider.name,
                            isSelected: vm.selectedProvider == provider.shortName
                        ) {
                            vm.selectProvider(provider.shortName)
                        }
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .padding(.horizontal, 48)
        .padding(.top, 40)
    }

    private var sortBinding: Binding<String> {
        Binding(get: { vm.sort }, set: { vm.setSort($0) })
    }

    private func providerChip(title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.callout)
                .fontWeight(isSelected ? .semibold : .regular)
                .padding(.horizontal, 22)
                .padding(.vertical, 12)
                .background(
                    isSelected ? Color.white.opacity(0.9) : Color.white.opacity(0.12),
                    in: Capsule()
                )
                .foregroundStyle(isSelected ? Color.black : Color.white)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Grid

    private var resultsGrid: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 32) {
                ForEach(vm.movies) { movie in
                    Button {
                        selectedMovie = movie
                    } label: {
                        PosterCard(
                            movie: movie.asSimplifiedMovie,
                            size: 200,
                            badge: ratingBadge(for: movie)
                        )
                    }
                    .buttonStyle(.card)
                    .task { await vm.loadMoreIfNeeded(after: movie) }
                }
            }
            .padding(48)

            if vm.isLoadingMore {
                ProgressView()
                    .padding(.bottom, 48)
            }
        }
    }

    private func ratingBadge(for movie: StreamingCatalogMovie) -> String? {
        guard let rating = movie.imdbRating, rating > 0 else { return nil }
        return "★ " + String(format: "%.1f", rating)
    }
}
