import SwiftUI

/// A lightweight reference used for value-based navigation to a detail page.
struct MediaRef: Hashable {
    let tmdbId: Int
    let mediaType: String
}

/// Poster + title cell used in grids. Maintains a 2:3 aspect ratio.
struct PosterCard: View {
    let title: String
    let posterURL: URL?
    var badge: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ZStack(alignment: .topTrailing) {
                ZStack {
                    Color(white: 0.14)
                    AsyncImage(url: posterURL) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Image(systemName: "film").font(.title2).foregroundStyle(.secondary)
                    }
                }
                .aspectRatio(2.0 / 3.0, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 10))

                if let badge {
                    Text(badge)
                        .font(.caption2).fontWeight(.semibold).foregroundStyle(.white)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(.black.opacity(0.65), in: Capsule())
                        .padding(6)
                }
            }

            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

extension PosterCard {
    init(movie: SimplifiedMovie, badge: String? = nil) {
        self.init(title: movie.title, posterURL: movie.posterURL(), badge: badge)
    }
}

/// Reusable two-column poster grid that navigates to a detail page on tap.
struct PosterGrid: View {
    let movies: [SimplifiedMovie]
    private let columns = [GridItem(.adaptive(minimum: 104), spacing: 14)]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 18) {
            ForEach(movies) { movie in
                NavigationLink(value: MediaRef(tmdbId: movie.tmdbId, mediaType: movie.resolvedMediaType)) {
                    PosterCard(movie: movie, badge: movie.imdbRating.map { String(format: "★ %.1f", $0) })
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// One row representing a saved/public list.
struct ListRowView: View {
    let list: SavedList

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 6)
                .fill(Color(hex: list.color ?? "") ?? Color(white: 0.3))
                .frame(width: 10, height: 36)

            VStack(alignment: .leading, spacing: 2) {
                Text(list.title).font(.body).fontWeight(.medium).lineLimit(1)
                Text("\(list.items.count) \(list.items.count == 1 ? "title" : "titles")"
                     + (list.username.map { " · @\($0)" } ?? ""))
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
        }
        .contentShape(Rectangle())
    }
}

// Maps the app's named list colors (and any hex) to a SwiftUI Color.
extension Color {
    init?(hex raw: String) {
        let named: [String: String] = [
            "sky": "38BDF8", "emerald": "22C55E", "amber": "FBBF24", "violet": "A78BFA",
            "rose": "FB7185", "indigo": "818CF8", "slate": "94A3B8",
        ]
        var s = (named[raw.lowercased()] ?? raw).trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s = String(s.dropFirst()) }
        guard s.count == 6, let value = UInt64(s, radix: 16) else { return nil }
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}
