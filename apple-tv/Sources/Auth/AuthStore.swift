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

    /// Exchanges the 4-digit pairing PIN for a durable token, then signs in.
    func signIn(pin: String) async {
        let digits = pin.filter(\.isNumber)
        guard digits.count == 4 else {
            error = "Enter the 4-digit code shown in Settings."
            return
        }

        isWorking = true
        error = nil
        defer { isWorking = false }

        let token: String
        do {
            token = try await APIClient.shared.claim(pin: digits)
        } catch {
            if case APIError.badStatus(_, 404, _) = error {
                self.error = "That code is invalid or has expired. Generate a new one."
            } else if case APIError.badStatus(_, 429, _) = error {
                self.error = "Too many attempts. Wait a moment and try again."
            } else {
                self.error = error.localizedDescription
            }
            return
        }

        APIClient.shared.authToken = token
        if await validate() {
            Keychain.save(token)
        } else {
            APIClient.shared.authToken = nil
        }
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
