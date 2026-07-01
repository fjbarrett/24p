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
            Tab("Home", systemImage: "square.stack") {
                HomeView()
            }
            Tab("Streaming", systemImage: "play.tv") {
                StreamingView()
            }
            Tab(auth.isSignedIn ? "Account" : "Sign In", systemImage: "person.crop.circle") {
                AccountView()
            }
            Tab("Search", systemImage: "magnifyingglass", role: .search) {
                SearchView()
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
    }
}
