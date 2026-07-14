import SwiftUI

struct PosterCard: View {
    let movie: SimplifiedMovie
    var size: CGFloat = 200
    /// Optional short text shown as a capsule in the poster's top-trailing corner (e.g. a rating).
    var badge: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .topTrailing) {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(white: 0.15))
                    .frame(width: size, height: size * 1.5)

                if let url = movie.posterURL() {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: size, height: size * 1.5)
                                .clipped()
                                .cornerRadius(12)
                        case .failure:
                            placeholderIcon
                        case .empty:
                            ProgressView()
                                .frame(width: size, height: size * 1.5)
                        @unknown default:
                            placeholderIcon
                        }
                    }
                } else {
                    placeholderIcon
                }

                if let badge {
                    Text(badge)
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.black.opacity(0.65), in: Capsule())
                        .padding(8)
                }
            }
            .frame(width: size, height: size * 1.5)
            .cornerRadius(12)

            Text(movie.title)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .frame(width: size, alignment: .leading)
        }
    }

    private var placeholderIcon: some View {
        Image(systemName: "film")
            .font(.largeTitle)
            .foregroundStyle(.secondary)
            .frame(width: size, height: size * 1.5)
    }
}

struct ListCard: View {
    let list: SavedList
    var width: CGFloat = 320

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16)
                .fill(cardColor)
                .frame(width: width, height: 180)

            VStack(alignment: .leading, spacing: 8) {
                Text(list.title)
                    .font(.headline)
                    .fontWeight(.bold)
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                if let username = list.username {
                    Text("@\(username)")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.75))
                }

                Spacer()

                Text("\(list.items.count) \(list.items.count == 1 ? "title" : "titles")")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.6))
            }
            .padding(20)
            .frame(width: width, height: 180, alignment: .topLeading)
        }
        .frame(width: width, height: 180)
    }

    private var cardColor: Color {
        guard let hex = list.color else { return Color(white: 0.2) }
        return Color(hex: hex) ?? Color(white: 0.2)
    }
}

// MARK: - List color helper

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
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
