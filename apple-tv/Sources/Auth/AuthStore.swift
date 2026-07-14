import SwiftUI

@MainActor
final class AuthStore: ObservableObject {
    @Published private(set) var user: SessionUser?
    @Published private(set) var pairingCode: String?
    @Published var isWorking = false
    @Published var error: String?

    var isSignedIn: Bool { user != nil }

    init() {
        if let token = Keychain.load(), !token.isEmpty {
            APIClient.shared.authToken = token
        }
    }

    /// Validates a previously stored token on launch (no-op if there isn't one).
    /// A transient failure keeps the session; only an explicit 401 signs out.
    func restore() async {
        guard let token = APIClient.shared.authToken, !token.isEmpty else { return }
        await validate(surfaceError: false)
    }

    private var pairingTask: Task<Void, Never>?

    /// Creates a device-bound request and waits for browser approval.
    /// Requesting a new code cancels any pairing already being polled.
    func beginPairing() {
        pairingTask?.cancel()
        pairingTask = Task { await runPairing() }
    }

    private func runPairing() async {
        isWorking = true
        error = nil
        do {
            let pairing = try await APIClient.shared.startPairing()
            guard !Task.isCancelled else { return }
            pairingCode = pairing.pin
            isWorking = false
            let deadline = Date().addingTimeInterval(TimeInterval(pairing.expiresInSeconds))
            while Date() < deadline && !Task.isCancelled {
                do {
                    let claim = try await APIClient.shared.checkPairing(pairing)
                    if claim.status == "approved", let token = claim.token {
                        // Persist before validating: the pairing is already consumed
                        // server-side, so a flaky /api/session must not lose the token.
                        APIClient.shared.authToken = token
                        Keychain.save(token)
                        pairingCode = nil
                        await validate(surfaceError: true)
                        return
                    }
                } catch {
                    // 404 means the pairing was consumed or expired server-side;
                    // anything else is transient — keep polling until the deadline.
                    if case APIError.badStatus(_, 404, _) = error { break }
                }
                try await Task.sleep(for: .seconds(5))
            }
            if !Task.isCancelled {
                pairingCode = nil
                error = "That code expired. Generate a new one."
            }
        } catch {
            if !Task.isCancelled {
                pairingCode = nil
                self.error = error.localizedDescription
            }
        }
        if !Task.isCancelled { isWorking = false }
    }

    func signOut() {
        pairingTask?.cancel()
        pairingTask = nil
        Keychain.delete()
        APIClient.shared.authToken = nil
        user = nil
        pairingCode = nil
        error = nil
    }

    @discardableResult
    private func validate(surfaceError: Bool) async -> Bool {
        do {
            let session = try await APIClient.shared.session()
            user = session.user
            error = nil
            return true
        } catch {
            if case APIError.badStatus(_, 401, _) = error {
                // The server rejected the bearer outright — wipe it so a stale
                // token can't wedge the app.
                signOut()
                if surfaceError {
                    self.error = "That code didn't work. Generate a fresh one and try again."
                }
            } else if surfaceError {
                self.error = error.localizedDescription
            }
            return false
        }
    }
}
