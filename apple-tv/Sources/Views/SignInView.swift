import SwiftUI

struct SignInView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var code = ""

    private var digits: String { code.filter(\.isNumber) }

    var body: some View {
        VStack(spacing: 28) {
            Image(systemName: "person.crop.circle.badge.checkmark")
                .font(.system(size: 80))
                .foregroundStyle(.secondary)

            VStack(spacing: 10) {
                Text("Sign in to 24p")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                Text("On your phone or computer, open **24p.mov → Settings → Apple TV**, tap “Generate code,” then enter the 4-digit code below.")
                    .font(.headline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 760)
            }

            TextField("0000", text: $code)
                .textContentType(.oneTimeCode)
                .autocorrectionDisabled()
                .font(.system(size: 56, weight: .semibold, design: .monospaced))
                .multilineTextAlignment(.center)
                .frame(maxWidth: 360)
                .onChange(of: code) {
                    // Keep digits only, cap at 4.
                    let filtered = String(code.filter(\.isNumber).prefix(4))
                    if filtered != code { code = filtered }
                }
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
            .disabled(auth.isWorking || digits.count != 4)
        }
        .padding(60)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func submit() {
        Task { await auth.signIn(pin: code) }
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
