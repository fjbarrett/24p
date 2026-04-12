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
    var body: some View {
        TabView {
            Tab("Home", systemImage: "house") {
                HomeView()
            }

            Tab("Search", systemImage: "magnifyingglass") {
                SearchView()
            }
        }
    }
}
