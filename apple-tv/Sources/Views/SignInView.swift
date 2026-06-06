import SwiftUI

struct SignInView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var code = ""

    var body: some View {
        VStack(spacing: 28) {
            Image(systemName: "person.crop.circle.badge.checkmark")
                .font(.system(size: 80))
                .foregroundStyle(.secondary)

            VStack(spacing: 10) {
                Text("Sign in to 24p")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                Text("On your phone or computer, open **24p.mov → Settings → Apple TV**, tap “Generate code,” then enter it below.")
                    .font(.headline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 760)
            }

            TextField("XXXX-XXXX-XXXX", text: $code)
                .textContentType(.oneTimeCode)
                .autocorrectionDisabled()
                .font(.title2.monospaced())
                .multilineTextAlignment(.center)
                .frame(maxWidth: 520)
                .onSubmit(submit)

            if let err = auth.error {
                Text(err)
                    .font(.callout)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 640)
            }

            Button(action: submit) {
                if auth.isWorking {
                    ProgressView()
                } else {
                    Text("Sign In")
                        .frame(minWidth: 200)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(auth.isWorking || code.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding(60)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func submit() {
        Task { await auth.signIn(code: code) }
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
