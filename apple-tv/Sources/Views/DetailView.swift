import SwiftUI

@MainActor
final class DetailViewModel: ObservableObject {
    @Published var movie: SimplifiedMovie?
    @Published var providers: [StreamingProvider] = []
    @Published var watchLinks: [WatchLinkOffer] = []
    @Published var justWatchLink: String?
    @Published var isLoading = false
    @Published var error: String?
    @Published var providerWarning: String?

    func load(tmdbId: Int, mediaType: String) async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        providerWarning = nil
        do {
            let detail = try await (mediaType == "tv"
                ? APIClient.shared.tvDetail(id: tmdbId)
                : APIClient.shared.movieDetail(id: tmdbId))
            movie = detail

            do {
                let providerResult = try await APIClient.shared.watchProviders(
                    tmdbId: tmdbId,
                    mediaType: mediaType
                )
                providers = providerResult.providers
                justWatchLink = providerResult.justWatchLink
            } catch {
                providers = []
                justWatchLink = nil
                providerWarning = error.localizedDescription
                print("[DetailViewModel] provider load failed for \(tmdbId) \(mediaType): \(error.localizedDescription)")
            }

            do {
                watchLinks = try await APIClient.shared.watchLinks(
                    title: detail.title,
                    year: detail.releaseYear,
                    mediaType: mediaType
                )
            } catch {
                if providerWarning == nil {
                    providerWarning = error.localizedDescription
                }
                print("[DetailViewModel] watch links load failed for \(tmdbId) \(mediaType): \(error.localizedDescription)")
            }
        } catch {
            self.error = error.localizedDescription
            print("[DetailViewModel] detail load failed for \(tmdbId) \(mediaType): \(error.localizedDescription)")
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
                VStack(spacing: 20) {
                    ContentUnavailableView(
                        "Couldn't load title",
                        systemImage: "exclamationmark.triangle",
                        description: Text(err)
                    )

                    Text(err)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 80)

                    Button("Retry") {
                        Task { await vm.load(tmdbId: tmdbId, mediaType: mediaType) }
                    }
                    .buttonStyle(.borderedProminent)
                }
            } else if let movie = vm.movie {
                DetailContentView(
                    movie: movie,
                    providers: vm.providers,
                    watchLinks: vm.watchLinks,
                    justWatchLink: vm.justWatchLink,
                    providerWarning: vm.providerWarning
                )
            } else {
                VStack(spacing: 20) {
                    Text("No detail loaded yet")
                        .font(.headline)
                    Text("tmdbId: \(tmdbId) mediaType: \(mediaType)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Button("Load Again") {
                        Task { await vm.load(tmdbId: tmdbId, mediaType: mediaType) }
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        }
        .task(id: "\(tmdbId)-\(mediaType)") {
            print("[DetailView] task start \(tmdbId) \(mediaType)")
            await vm.load(tmdbId: tmdbId, mediaType: mediaType)
        }
    }
}

struct DetailContentView: View {
    let movie: SimplifiedMovie
    let providers: [StreamingProvider]
    let watchLinks: [WatchLinkOffer]
    let justWatchLink: String?
    let providerWarning: String?

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
        HStack(alignment: .top, spacing: 36) {
            posterColumn

            VStack(alignment: .leading, spacing: 28) {
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

                if let tagline = movie.tagline, !tagline.isEmpty {
                    Text(tagline)
                        .font(.title3)
                        .italic()
                        .foregroundStyle(.secondary)
                }

                if let overview = movie.overview, !overview.isEmpty {
                    Text(overview)
                        .font(.body)
                        .foregroundStyle(.primary)
                        .lineLimit(6)
                }

                if let director = movie.director {
                    creditRow(label: "Director", names: [director.name])
                }
                if let cast = movie.cast, !cast.isEmpty {
                    creditRow(label: "Cast", names: cast.prefix(5).map(\.name))
                }

                if !providers.isEmpty && watchLinks.isEmpty {
                    providersSection
                }
                if let providerWarning, !providerWarning.isEmpty {
                    Text("Watch providers unavailable: \(providerWarning)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(40)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20))
    }

    // MARK: - Subviews

    private var posterColumn: some View {
        VStack(alignment: .leading, spacing: 18) {
            ZStack {
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color.white.opacity(0.08))
                    .frame(width: 240, height: 360)

                if let url = movie.posterURL(size: "w500") {
                    AsyncImage(url: url) { phase in
                        if case .success(let image) = phase {
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 240, height: 360)
                                .clipShape(RoundedRectangle(cornerRadius: 20))
                        }
                    }
                }
            }

            if !watchLinks.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(watchLinks.prefix(4)) { offer in
                        providerLinkButton(offer)
                    }
                }
            }

            if let link = justWatchLink, let url = URL(string: link) {
                Button {
                    openURL(url)
                } label: {
                    Label("More Streaming Options", systemImage: "play.tv.fill")
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.bordered)
                .frame(width: 240)
            }
        }
        .frame(width: 240, alignment: .topLeading)
    }

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

    private func providerLinkButton(_ offer: WatchLinkOffer) -> some View {
        Button {
            guard let url = URL(string: offer.url) else { return }
            openURL(url)
        } label: {
            HStack(spacing: 12) {
                if let iconURL = offer.iconURL {
                    AsyncImage(url: iconURL) { phase in
                        if case .success(let image) = phase {
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(width: 36, height: 36)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        } else {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.white.opacity(0.12))
                                .frame(width: 36, height: 36)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(offer.providerName)
                        .font(.subheadline)
                        .lineLimit(1)
                    Text(offer.accessModel.capitalized)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(width: 240, alignment: .leading)
            .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
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
