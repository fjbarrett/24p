import SwiftUI

@MainActor
final class AuthStore: ObservableObject {
    @Published private(set) var user: SessionUser?
    @Published var isWorking = false
    @Published var error: String?

    var isSignedIn: Bool { user != nil }

    init() {
        if let token = Keychain.load(), !token.isEmpty {
            APIClient.shared.authToken = token
        }
    }

    /// Validates a previously stored token on launch (no-op if there isn't one).
    func restore() async {
        guard let token = APIClient.shared.authToken, !token.isEmpty else { return }
        await validate()
    }

    func signIn(code: String) async {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        isWorking = true
        error = nil
        APIClient.shared.authToken = trimmed

        let ok = await validate()
        if ok {
            Keychain.save(trimmed)
        } else {
            APIClient.shared.authToken = nil
        }
        isWorking = false
    }

    func signOut() {
        Keychain.delete()
        APIClient.shared.authToken = nil
        user = nil
        error = nil
    }

    @discardableResult
    private func validate() async -> Bool {
        do {
            let session = try await APIClient.shared.session()
            user = session.user
            error = nil
            return true
        } catch {
            user = nil
            if case APIError.badStatus(_, 401, _) = error {
                self.error = "That code didn't work. Generate a fresh one and try again."
            } else {
                self.error = error.localizedDescription
            }
            return false
        }
    }
}
