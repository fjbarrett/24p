import SwiftUI

/// Shared visual constants so cards, grids, and glass surfaces stay consistent.
enum Theme {
    static let posterRadius: CGFloat = 14
    static let cardRadius: CGFloat = 18
    static let posterGridMin: CGFloat = 110
    static let gridSpacing: CGFloat = 16
}

/// A lightweight reference used for value-based navigation to a detail page.
struct MediaRef: Hashable {
    let tmdbId: Int
    let mediaType: String
}

/// Poster + title cell used in grids. Maintains a 2:3 aspect ratio with a
/// frosted Liquid Glass rating badge.
struct PosterCard: View {
    let title: String
    let posterURL: URL?
    var badge: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            ZStack(alignment: .bottomTrailing) {
                poster
                if let badge {
                    Text(badge)
                        .font(.caption2).fontWeight(.semibold)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .glassEffect(.regular, in: .capsule)
                        .padding(7)
                }
            }

            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var poster: some View {
        ZStack {
            Rectangle().fill(Color(white: 0.14))
            AsyncImage(url: posterURL) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                case .empty:
                    ProgressView().tint(.secondary)
                default:
                    Image(systemName: "film").font(.title2).foregroundStyle(.tertiary)
                }
            }
        }
        .aspectRatio(2.0 / 3.0, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: Theme.posterRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.posterRadius, style: .continuous)
                .strokeBorder(.white.opacity(0.08), lineWidth: 0.5)
        )
        .shadow(color: .black.opacity(0.35), radius: 8, y: 4)
    }
}

extension PosterCard {
    init(movie: SimplifiedMovie, badge: String? = nil) {
        self.init(title: movie.title, posterURL: movie.posterURL(), badge: badge)
    }
}

/// Reusable poster grid that navigates to a detail page on tap.
struct PosterGrid: View {
    let movies: [SimplifiedMovie]
    private let columns = [GridItem(.adaptive(minimum: Theme.posterGridMin), spacing: Theme.gridSpacing)]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 20) {
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
        HStack(spacing: 13) {
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [chipColor, chipColor.opacity(0.55)],
                        startPoint: .top, endPoint: .bottom)
                )
                .frame(width: 5, height: 38)

            VStack(alignment: .leading, spacing: 3) {
                Text(list.title).font(.body.weight(.semibold)).lineLimit(1)
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .contentShape(Rectangle())
    }

    private var chipColor: Color { Color(hex: list.color ?? "") ?? Color(white: 0.4) }

    private var subtitle: String {
        let n = list.items.count
        return "\(n) \(n == 1 ? "title" : "titles")" + (list.username.map { " · @\($0)" } ?? "")
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
