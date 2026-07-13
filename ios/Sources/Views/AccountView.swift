import SwiftUI

struct AccountView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            Form {
                if auth.isSignedIn, let user = auth.user {
                    Section {
                        HStack(spacing: 14) {
                            avatar(user)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(user.name?.isEmpty == false ? user.name! : "24p member")
                                    .font(.headline)
                                if let username = auth.profile?.username {
                                    Text("@\(username)")
                                        .font(.subheadline).foregroundStyle(.secondary)
                                }
                                Text(user.email)
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer(minLength: 0)
                        }
                        .padding(.vertical, 4)
                    }
                    Section {
                        Button("Sign Out", role: .destructive) { auth.signOut() }
                    }
                } else {
                    Section {
                        Text("Pair this app with your 24p account:")
                            .font(.subheadline)
                        Text("1. Generate a code below.\n2. Sign in at 24p.mov and open Settings → Apple devices.\n3. Enter the code there to approve this iPhone.")
                            .font(.footnote).foregroundStyle(.secondary)
                        Button {
                            if let url = URL(string: "https://24p.mov/settings") { openURL(url) }
                        } label: {
                            Label("Get a code at 24p.mov", systemImage: "safari")
                        }
                    }
                    Section("Pairing code") {
                        if let code = auth.pairingCode {
                            Text(code)
                                .font(.system(.largeTitle, design: .monospaced, weight: .semibold))
                                .tracking(8)
                                .textSelection(.enabled)
                            Text("Waiting for approval at 24p.mov/settings")
                                .font(.footnote).foregroundStyle(.secondary)
                        } else {
                            Button {
                                auth.beginPairing()
                            } label: {
                                if auth.isWorking { ProgressView() } else { Text("Generate Pairing Code") }
                            }
                            .disabled(auth.isWorking)
                        }
                    }
                    if let error = auth.error {
                        Section {
                            Text(error).font(.footnote).foregroundStyle(.red)
                        }
                    }
                }
            }
            .navigationTitle(auth.isSignedIn ? "Account" : "Sign In")
        }
    }

    private func avatar(_ user: SessionUser) -> some View {
        AsyncImage(url: user.image.flatMap(URL.init(string:))) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            Image(systemName: "person.crop.circle.fill")
                .resizable().scaledToFit()
                .foregroundStyle(.secondary)
        }
        .frame(width: 56, height: 56)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(.white.opacity(0.12), lineWidth: 0.5))
    }
}
