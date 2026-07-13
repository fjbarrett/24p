import SwiftUI

struct SignInView: View {
    @EnvironmentObject private var auth: AuthStore
    var body: some View {
        VStack(spacing: 28) {
            Image(systemName: "person.crop.circle.badge.checkmark")
                .font(.system(size: 80))
                .foregroundStyle(.secondary)

            VStack(spacing: 10) {
                Text("Sign in to 24p")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                Text("Generate a code here, then open **24p.mov → Settings → Apple devices** on your phone or computer and approve this Apple TV.")
                    .font(.headline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 760)
            }

            if let code = auth.pairingCode {
                Text(code)
                    .font(.system(size: 64, weight: .semibold, design: .monospaced))
                    .tracking(12)
                Text("Waiting for approval")
                    .font(.headline)
                    .foregroundStyle(.secondary)
            }

            if let err = auth.error {
                Text(err)
                    .font(.callout)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 640)
            }

            Button {
                auth.beginPairing()
            } label: {
                if auth.isWorking {
                    ProgressView()
                } else {
                    Text(auth.pairingCode == nil ? "Generate Pairing Code" : "Generate New Code")
                        .frame(minWidth: 200)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(auth.isWorking)
        }
        .padding(60)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct AccountView: View {
    @EnvironmentObject private var auth: AuthStore

    var body: some View {
        if let user = auth.user {
            VStack(spacing: 24) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 72))
                    .foregroundStyle(.green)

                VStack(spacing: 8) {
                    Text(user.name ?? user.email)
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    Text(user.email)
                        .font(.headline)
                        .foregroundStyle(.secondary)
                }

                Button("Sign Out", role: .destructive) {
                    auth.signOut()
                }
                .buttonStyle(.bordered)
            }
            .padding(60)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            SignInView()
        }
    }
}
