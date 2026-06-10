import SwiftUI

@main
struct TwentyFourPApp: App {
    @StateObject private var auth = AuthStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .tint(.white)
                .preferredColorScheme(.dark)
                .task { await auth.restore() }
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var auth: AuthStore

    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Home", systemImage: "square.stack") }
            SearchView()
                .tabItem { Label("Search", systemImage: "magnifyingglass") }
            StreamingView()
                .tabItem { Label("Streaming", systemImage: "play.tv") }
            AccountView()
                .tabItem { Label(auth.isSignedIn ? "Account" : "Sign In", systemImage: "person.crop.circle") }
        }
    }
}
