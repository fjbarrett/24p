import SwiftUI

@MainActor
final class DetailViewModel: ObservableObject {
    @Published var movie: SimplifiedMovie?
    @Published var providers: [StreamingProvider] = []
    @Published var watchLinks: [WatchLinkOffer] = []
    @Published var justWatchLink: String?
    @Published var isLoading = false
    @Published var error: String?

    func load(tmdbId: Int, mediaType: String) async {
        guard movie == nil, !isLoading else { return }
        isLoading = true
        error = nil
        do {
            let detail = try await APIClient.shared.detail(tmdbId: tmdbId, mediaType: mediaType)
            movie = detail
            if let result = try? await APIClient.shared.watchProviders(tmdbId: tmdbId, mediaType: mediaType) {
                providers = result.providers
                justWatchLink = result.justWatchLink
            }
            watchLinks = (try? await APIClient.shared.watchLinks(
                title: detail.title, year: detail.releaseYear, mediaType: mediaType)) ?? []
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
    @State private var showAddSheet = false
    @Environment(\.openURL) private var openURL

    var body: some View {
        Group {
            if let movie = vm.movie {
                content(movie)
            } else if let error = vm.error {
                ContentUnavailableView("Couldn't load title", systemImage: "exclamationmark.triangle",
                                       description: Text(error))
            } else {
                ProgressView()
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.load(tmdbId: tmdbId, mediaType: mediaType) }
        .sheet(isPresented: $showAddSheet) {
            if let movie = vm.movie { AddToListSheet(movie: movie) }
        }
    }

    @ViewBuilder
    private func content(_ movie: SimplifiedMovie) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                backdrop(movie)
                VStack(alignment: .leading, spacing: 18) {
                    header(movie)

                    Button {
                        showAddSheet = true
                    } label: {
                        Label("Add to a List", systemImage: "plus")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.white)
                    .foregroundStyle(.black)

                    if let tagline = movie.tagline, !tagline.isEmpty {
                        Text(tagline).font(.callout).italic().foregroundStyle(.secondary)
                    }
                    if let overview = movie.overview, !overview.isEmpty {
                        Text(overview).font(.body)
                    }
                    credits(movie)
                    watchSection
                }
                .padding(.horizontal)
                .padding(.bottom, 28)
            }
        }
        .navigationTitle(movie.title)
    }

    @ViewBuilder
    private func backdrop(_ movie: SimplifiedMovie) -> some View {
        if let url = movie.backdropURL(size: "w780") {
            AsyncImage(url: url) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Color(white: 0.12)
            }
            .frame(height: 210)
            .frame(maxWidth: .infinity)
            .clipped()
        }
    }

    private func header(_ movie: SimplifiedMovie) -> some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                Color(white: 0.14)
                AsyncImage(url: movie.posterURL(size: "w342")) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Image(systemName: "film").foregroundStyle(.secondary)
                }
            }
            .frame(width: 96, height: 144)
            .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 8) {
                Text(movie.title).font(.title3).fontWeight(.bold)
                HStack(spacing: 8) {
                    if let year = movie.releaseYear { metaTag(String(year)) }
                    if let runtime = movie.runtime, runtime > 0 { metaTag(formatRuntime(runtime)) }
                    if let rating = movie.imdbRating ?? movie.rating {
                        metaTag(String(format: "★ %.1f", rating))
                    }
                }
                if let genres = movie.genres, !genres.isEmpty {
                    Text(genres.prefix(3).joined(separator: " · "))
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder
    private func credits(_ movie: SimplifiedMovie) -> some View {
        if let director = movie.director {
            creditRow("Director", [director.name])
        }
        if let cast = movie.cast, !cast.isEmpty {
            creditRow("Cast", cast.prefix(5).map(\.name))
        }
    }

    @ViewBuilder
    private var watchSection: some View {
        if !vm.watchLinks.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Where to Watch").font(.headline)
                ForEach(vm.watchLinks.prefix(6)) { offer in
                    Button {
                        if let url = URL(string: offer.url) { openURL(url) }
                    } label: {
                        HStack(spacing: 12) {
                            AsyncImage(url: offer.iconURL) { image in
                                image.resizable().scaledToFit()
                            } placeholder: {
                                RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.12))
                            }
                            .frame(width: 34, height: 34)
                            .clipShape(RoundedRectangle(cornerRadius: 8))

                            VStack(alignment: .leading, spacing: 1) {
                                Text(offer.providerName).font(.subheadline)
                                Text(offer.accessModel.capitalized).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "arrow.up.right").font(.caption).foregroundStyle(.tertiary)
                        }
                        .padding(12)
                        .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                }
            }
        } else if !vm.providers.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Where to Watch").font(.headline)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 14) {
                        ForEach(vm.providers) { provider in
                            VStack(spacing: 6) {
                                AsyncImage(url: provider.logoURL) { image in
                                    image.resizable().scaledToFit()
                                } placeholder: {
                                    RoundedRectangle(cornerRadius: 10).fill(Color(white: 0.2))
                                }
                                .frame(width: 50, height: 50)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                Text(provider.name).font(.caption2).lineLimit(1).frame(width: 60)
                            }
                        }
                    }
                }
            }
        }
    }

    private func creditRow(_ label: String, _ names: [String]) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text(label).font(.subheadline).fontWeight(.semibold).foregroundStyle(.secondary)
                .frame(width: 64, alignment: .leading)
            Text(names.joined(separator: ", ")).font(.subheadline)
            Spacer(minLength: 0)
        }
    }

    private func metaTag(_ text: String) -> some View {
        Text(text)
            .font(.caption).foregroundStyle(.secondary)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(Color(white: 0.2), in: Capsule())
    }

    private func formatRuntime(_ minutes: Int) -> String {
        let h = minutes / 60, m = minutes % 60
        return h > 0 ? "\(h)h \(m)m" : "\(m)m"
    }
}

// MARK: - Add to list

struct AddToListSheet: View {
    let movie: SimplifiedMovie

    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss

    @State private var lists: [SavedList] = []
    @State private var isLoading = false
    @State private var working = false
    @State private var newTitle = ""
    @State private var message: String?

    var body: some View {
        NavigationStack {
            Group {
                if !auth.isSignedIn {
                    ContentUnavailableView(
                        "Sign in to save",
                        systemImage: "person.crop.circle",
                        description: Text("Pair this app with your 24p account from the Sign In tab."))
                } else if isLoading {
                    ProgressView()
                } else {
                    List {
                        Section("New list") {
                            HStack {
                                TextField("List name", text: $newTitle)
                                Button("Create") { Task { await create() } }
                                    .disabled(newTitle.trimmingCharacters(in: .whitespaces).isEmpty || working)
                            }
                        }
                        Section("Add to") {
                            if editableLists.isEmpty {
                                Text("No editable lists yet.").foregroundStyle(.secondary)
                            }
                            ForEach(editableLists) { list in
                                Button { Task { await add(to: list) } } label: {
                                    ListRowView(list: list)
                                }
                                .disabled(working)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Add to list")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .overlay(alignment: .bottom) {
                if let message {
                    Text(message)
                        .font(.subheadline)
                        .padding(.horizontal, 16).padding(.vertical, 10)
                        .background(.ultraThinMaterial, in: Capsule())
                        .padding(.bottom, 24)
                }
            }
            .task { await loadLists() }
        }
    }

    private var editableLists: [SavedList] {
        lists.filter { $0.isEditable }
    }

    private func loadLists() async {
        guard auth.isSignedIn else { return }
        isLoading = true
        lists = (try? await APIClient.shared.myLists()) ?? []
        isLoading = false
    }

    private func add(to list: SavedList) async {
        working = true
        do {
            _ = try await APIClient.shared.addToList(
                listId: list.id, tmdbId: movie.tmdbId, mediaType: movie.resolvedMediaType)
            flash("Added to “\(list.title)”")
        } catch {
            flash(error.localizedDescription)
        }
        working = false
    }

    private func create() async {
        let title = newTitle.trimmingCharacters(in: .whitespaces)
        guard !title.isEmpty else { return }
        working = true
        do {
            let list = try await APIClient.shared.createList(
                title: title, tmdbId: movie.tmdbId, mediaType: movie.resolvedMediaType)
            newTitle = ""
            lists.insert(list, at: 0)
            flash("Created “\(list.title)”")
        } catch {
            flash(error.localizedDescription)
        }
        working = false
    }

    private func flash(_ text: String) {
        message = text
        Task {
            try? await Task.sleep(for: .seconds(2))
            if message == text { message = nil }
        }
    }
}
