import SwiftUI

@MainActor
final class AuthStore: ObservableObject {
    @Published private(set) var user: SessionUser?
    @Published private(set) var profile: SessionProfile?
    @Published var isWorking = false
    @Published var error: String?

    var isSignedIn: Bool { user != nil }

    init() {
        if let token = Keychain.load(), !token.isEmpty {
            APIClient.shared.authToken = token
        }
    }

    /// Validates a stored token on launch. A transient failure (e.g. offline)
    /// keeps the session; only an explicit 401 signs the user out.
    func restore() async {
        guard APIClient.shared.authToken?.isEmpty == false else { return }
        await validate(surfaceError: false)
    }

    /// Exchanges the 4-digit pairing PIN (minted on the web at 24p.mov) for a
    /// long-lived bearer, stores it, then loads the session.
    func signIn(pin: String) async {
        let trimmed = pin.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 4 else {
            error = "Enter the 4-digit code shown on 24p.mov."
            return
        }
        isWorking = true
        error = nil
        do {
            let token = try await APIClient.shared.claim(pin: trimmed)
            APIClient.shared.authToken = token
            Keychain.save(token)
            await validate(surfaceError: true)
        } catch {
            APIClient.shared.authToken = nil
            self.error = (error as? APIError)?.statusCode == 404
                ? "That code is invalid or expired. Generate a new one."
                : error.localizedDescription
        }
        isWorking = false
    }

    func signOut() {
        Keychain.delete()
        APIClient.shared.authToken = nil
        user = nil
        profile = nil
        error = nil
    }

    @discardableResult
    private func validate(surfaceError: Bool) async -> Bool {
        do {
            let session = try await APIClient.shared.session()
            user = session.user
            profile = session.profile
            error = nil
            return true
        } catch {
            if (error as? APIError)?.statusCode == 401 {
                signOut()
            } else if surfaceError {
                self.error = error.localizedDescription
            }
            return false
        }
    }
}
