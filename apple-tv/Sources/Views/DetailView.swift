import SwiftUI

@MainActor
final class DetailViewModel: ObservableObject {
    @Published var movie: SimplifiedMovie?
    @Published var providers: [StreamingProvider] = []
    @Published var justWatchLink: String?
    @Published var isLoading = false
    @Published var error: String?

    func load(tmdbId: Int, mediaType: String) async {
        isLoading = true
        error = nil
        do {
            async let detailTask = mediaType == "tv"
                ? APIClient.shared.tvDetail(id: tmdbId)
                : APIClient.shared.movieDetail(id: tmdbId)
            async let providersTask = APIClient.shared.watchProviders(tmdbId: tmdbId, mediaType: mediaType)

            let (detail, providerResult) = try await (detailTask, providersTask)
            movie = detail
            providers = providerResult.providers
            justWatchLink = providerResult.justWatchLink
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

struct DetailView: View {
    let tmdbId: Int
    let mediaType: String

    @StateObject private var vm = DetailViewModel()

    var body: some View {
        Group {
            if vm.isLoading {
                ProgressView()
            } else if let err = vm.error {
                ContentUnavailableView(
                    "Couldn't load title",
                    systemImage: "exclamationmark.triangle",
                    description: Text(err)
                )
            } else if let movie = vm.movie {
                DetailContentView(movie: movie, providers: vm.providers, justWatchLink: vm.justWatchLink)
            }
        }
        .task { await vm.load(tmdbId: tmdbId, mediaType: mediaType) }
    }
}

struct DetailContentView: View {
    let movie: SimplifiedMovie
    let providers: [StreamingProvider]
    let justWatchLink: String?

    @Environment(\.openURL) private var openURL

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            // Full-bleed backdrop
            backdropLayer

            // Scrollable content overlay
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    // Spacer to push content below the visible backdrop area
                    Color.clear.frame(height: 480)

                    contentCard
                        .padding(.horizontal, 80)
                        .padding(.bottom, 80)
                }
            }
        }
        .ignoresSafeArea()
        .navigationTitle(movie.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Backdrop

    @ViewBuilder
    private var backdropLayer: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                if let url = movie.backdropURL(size: "w1280") {
                    AsyncImage(url: url) { phase in
                        if case .success(let image) = phase {
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: geo.size.width, height: geo.size.height * 0.65)
                                .clipped()
                        }
                    }
                }

                // Gradient fade to dark
                LinearGradient(
                    colors: [.clear, Color.black.opacity(0.3), .black],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: geo.size.height * 0.5)
            }
            .frame(width: geo.size.width, height: geo.size.height * 0.65, alignment: .top)
        }
        .ignoresSafeArea()
    }

    // MARK: - Content card

    private var contentCard: some View {
        VStack(alignment: .leading, spacing: 28) {
            // Title + meta row
            VStack(alignment: .leading, spacing: 8) {
                Text(movie.title)
                    .font(.largeTitle)
                    .fontWeight(.bold)

                HStack(spacing: 16) {
                    if let year = movie.releaseYear {
                        metaTag(String(year))
                    }
                    if let runtime = movie.runtime, runtime > 0 {
                        metaTag(formatRuntime(runtime))
                    }
                    if let rating = movie.imdbRating ?? movie.rating {
                        metaTag("★ \(String(format: "%.1f", rating))")
                    }
                    if let genres = movie.genres, !genres.isEmpty {
                        metaTag(genres.prefix(2).joined(separator: ", "))
                    }
                }
            }

            // Tagline
            if let tagline = movie.tagline, !tagline.isEmpty {
                Text(tagline)
                    .font(.title3)
                    .italic()
                    .foregroundStyle(.secondary)
            }

            // Overview
            if let overview = movie.overview, !overview.isEmpty {
                Text(overview)
                    .font(.body)
                    .foregroundStyle(.primary)
                    .lineLimit(6)
            }

            // Director + cast
            if let director = movie.director {
                creditRow(label: "Director", names: [director.name])
            }
            if let cast = movie.cast, !cast.isEmpty {
                creditRow(label: "Cast", names: cast.prefix(5).map(\.name))
            }

            // Streaming providers
            if !providers.isEmpty {
                providersSection
            }

            // JustWatch link
            if let link = justWatchLink, let url = URL(string: link) {
                Button {
                    openURL(url)
                } label: {
                    Label("Browse on JustWatch", systemImage: "play.tv.fill")
                }
                .buttonStyle(.bordered)
            }
        }
        .padding(40)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20))
    }

    // MARK: - Subviews

    private var providersSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Where to Watch")
                .font(.headline)
                .foregroundStyle(.secondary)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 16) {
                    ForEach(providers) { provider in
                        VStack(spacing: 8) {
                            AsyncImage(url: provider.logoURL) { phase in
                                if case .success(let image) = phase {
                                    image
                                        .resizable()
                                        .aspectRatio(contentMode: .fit)
                                        .frame(width: 60, height: 60)
                                        .cornerRadius(12)
                                } else {
                                    RoundedRectangle(cornerRadius: 12)
                                        .fill(Color(white: 0.2))
                                        .frame(width: 60, height: 60)
                                }
                            }
                            Text(provider.name)
                                .font(.caption2)
                                .lineLimit(1)
                                .frame(width: 70)
                        }
                    }
                }
            }
        }
    }

    private func metaTag(_ text: String) -> some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Color(white: 0.2), in: Capsule())
    }

    private func creditRow(label: String, names: [String]) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text(label + ":")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
                .frame(width: 80, alignment: .leading)
            Text(names.joined(separator: ", "))
                .font(.subheadline)
                .foregroundStyle(.primary)
        }
    }

    // MARK: - Helpers

    private func formatRuntime(_ minutes: Int) -> String {
        let h = minutes / 60
        let m = minutes % 60
        return h > 0 ? "\(h)h \(m)m" : "\(m)m"
    }
}
