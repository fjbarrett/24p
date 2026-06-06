import SwiftUI

@main
struct TwentyFourPApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

struct RootView: View {
    @StateObject private var auth = AuthStore()

    var body: some View {
        TabView {
            HomeView()
                .tabItem {
                    Label("Home", systemImage: "house")
                }

            SearchView()
                .tabItem {
                    Label("Search", systemImage: "magnifyingglass")
                }

            StreamingView()
                .tabItem {
                    Label("Streaming", systemImage: "play.tv")
                }

            AccountView()
                .tabItem {
                    Label(auth.isSignedIn ? "Account" : "Sign In", systemImage: "person.crop.circle")
                }
        }
        .environmentObject(auth)
        .task { await auth.restore() }
    }
}
