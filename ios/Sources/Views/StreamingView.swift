import SwiftUI

@MainActor
final class StreamingViewModel: ObservableObject {
    @Published var movies: [StreamingCatalogMovie] = []
    @Published var providers: [StreamingPlatform] = []
    @Published var selected: Set<String> = []
    @Published var sort = "popularity"
    @Published var isLoading = false
    @Published var error: String?

    private var seed: String?
    private var page = 1
    private var hasNext = true
    private var loadToken = 0
    private var loadingMore = false

    func loadInitialIfNeeded() async {
        if movies.isEmpty && !isLoading { await reload() }
    }

    func reload() async {
        loadToken += 1
        let token = loadToken
        isLoading = true
        error = nil
        seed = nil
        hasNext = true
        page = 1
        do {
            let resp = try await APIClient.shared.streamingCatalog(
                providers: Array(selected), sort: sort, seed: nil, page: 1)
            guard token == loadToken else { return }
            movies = resp.movies
            if !resp.providers.isEmpty { providers = resp.providers }
            seed = resp.seed
            hasNext = resp.hasNextPage
        } catch {
            guard token == loadToken else { return }
            self.error = error.localizedDescription
        }
        if token == loadToken { isLoading = false }
    }

    func loadMoreIfNeeded(current: StreamingCatalogMovie) async {
        guard hasNext, !loadingMore, !isLoading,
              let index = movies.firstIndex(of: current), index >= movies.count - 6 else { return }
        loadingMore = true
        let token = loadToken
        let next = page + 1
        do {
            let resp = try await APIClient.shared.streamingCatalog(
                providers: Array(selected), sort: sort, seed: seed, page: next)
            guard token == loadToken else { loadingMore = false; return }
            // De-dupe by justWatchId — movie and TV tmdbId namespaces overlap.
            let existing = Set(movies.map(\.id))
            movies.append(contentsOf: resp.movies.filter { !existing.contains($0.id) })
            hasNext = resp.hasNextPage
            page = next
        } catch {
            // soft-fail: keep what we have
        }
        loadingMore = false
    }

    func toggle(_ shortName: String) {
        if selected.contains(shortName) { selected.remove(shortName) } else { selected.insert(shortName) }
    }
}

struct StreamingView: View {
    @StateObject private var vm = StreamingViewModel()
    private let columns = [GridItem(.adaptive(minimum: 104), spacing: 14)]

    var body: some View {
        NavigationStack {
            ScrollView {
                controls
                if vm.isLoading && vm.movies.isEmpty {
                    ProgressView().padding(.top, 40)
                } else if let error = vm.error, vm.movies.isEmpty {
                    ContentUnavailableView("Couldn't load", systemImage: "wifi.slash", description: Text(error))
                        .padding(.top, 40)
                } else {
                    LazyVGrid(columns: columns, spacing: 18) {
                        ForEach(vm.movies) { movie in
                            NavigationLink(value: MediaRef(tmdbId: movie.tmdbId, mediaType: movie.mediaType)) {
                                PosterCard(
                                    title: movie.title,
                                    posterURL: movie.posterURL,
                                    badge: movie.imdbRating.map { String(format: "★ %.1f", $0) })
                            }
                            .buttonStyle(.plain)
                            .task { await vm.loadMoreIfNeeded(current: movie) }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 24)
                }
            }
            .navigationTitle("Streaming")
            .navigationDestination(for: MediaRef.self) { DetailView(tmdbId: $0.tmdbId, mediaType: $0.mediaType) }
        }
        .task { await vm.loadInitialIfNeeded() }
    }

    private var controls: some View {
        VStack(spacing: 12) {
            Picker("Sort", selection: $vm.sort) {
                Text("Popular").tag("popularity")
                Text("Top rated").tag("rating")
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .onChange(of: vm.sort) { Task { await vm.reload() } }

            if !vm.providers.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    GlassEffectContainer(spacing: 8) {
                        HStack(spacing: 8) {
                            ForEach(vm.providers) { provider in
                                chip(provider)
                            }
                        }
                    }
                    .padding(.horizontal)
                }
            }
        }
        .padding(.top, 6)
    }

    private func chip(_ provider: StreamingPlatform) -> some View {
        let on = vm.selected.contains(provider.shortName)
        return Button {
            vm.toggle(provider.shortName)
            Task { await vm.reload() }
        } label: {
            Text(provider.name)
                .font(.caption.weight(.medium))
                .foregroundStyle(on ? .black : .white)
                .padding(.horizontal, 14).padding(.vertical, 8)
        }
        .buttonStyle(.plain)
        .glassEffect(
            on ? .regular.tint(.white).interactive() : .regular.interactive(),
            in: .capsule)
    }
}
