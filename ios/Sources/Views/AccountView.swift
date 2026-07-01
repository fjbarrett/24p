import SwiftUI

struct AccountView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.openURL) private var openURL
    @State private var pin = ""

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
                        Text("1. Sign in at 24p.mov, open Settings → Apple TV.\n2. Generate a 4-digit code.\n3. Enter it below.")
                            .font(.footnote).foregroundStyle(.secondary)
                        Button {
                            if let url = URL(string: "https://24p.mov/settings") { openURL(url) }
                        } label: {
                            Label("Get a code at 24p.mov", systemImage: "safari")
                        }
                    }
                    Section("Pairing code") {
                        TextField("4-digit code", text: $pin)
                            .keyboardType(.numberPad)
                            .textContentType(.oneTimeCode)
                        Button {
                            Task {
                                await auth.signIn(pin: pin)
                                if auth.isSignedIn { pin = "" }
                            }
                        } label: {
                            if auth.isWorking {
                                ProgressView()
                            } else {
                                Text("Sign In")
                            }
                        }
                        .disabled(auth.isWorking || pin.trimmingCharacters(in: .whitespaces).count < 4)
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
