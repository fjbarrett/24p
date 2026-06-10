import SwiftUI

struct AccountView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.openURL) private var openURL
    @State private var pin = ""

    var body: some View {
        NavigationStack {
            Form {
                if auth.isSignedIn, let user = auth.user {
                    Section("Signed in") {
                        if let name = user.name, !name.isEmpty {
                            LabeledContent("Name", value: name)
                        }
                        LabeledContent("Email", value: user.email)
                        if let username = auth.profile?.username {
                            LabeledContent("Username", value: "@\(username)")
                        }
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
}
