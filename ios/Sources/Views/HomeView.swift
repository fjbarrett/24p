import SwiftUI

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var myLists: [SavedList] = []
    @Published var publicLists: [SavedList] = []
    @Published var isLoading = false
    @Published var error: String?

    func load(isSignedIn: Bool) async {
        isLoading = true
        error = nil
        if isSignedIn {
            myLists = (try? await APIClient.shared.myLists()) ?? []
        } else {
            myLists = []
        }
        do {
            publicLists = try await APIClient.shared.publicLists(limit: 30)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

struct HomeView: View {
    @EnvironmentObject private var auth: AuthStore
    @StateObject private var vm = HomeViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading && vm.publicLists.isEmpty && vm.myLists.isEmpty {
                    ProgressView()
                } else if let error = vm.error, vm.publicLists.isEmpty, vm.myLists.isEmpty {
                    ContentUnavailableView("Couldn't load", systemImage: "wifi.slash", description: Text(error))
                } else {
                    List {
                        if auth.isSignedIn {
                            Section("Your Lists") {
                                if vm.myLists.isEmpty {
                                    Text("No lists yet — add a title from Search or Streaming.")
                                        .foregroundStyle(.secondary)
                                } else {
                                    ForEach(vm.myLists) { list in
                                        NavigationLink(value: list) { ListRowView(list: list) }
                                    }
                                }
                            }
                        }
                        Section(auth.isSignedIn ? "Discover" : "Public Lists") {
                            ForEach(vm.publicLists) { list in
                                NavigationLink(value: list) { ListRowView(list: list) }
                            }
                        }
                    }
                }
            }
            .navigationTitle("24p")
            .refreshable { await vm.load(isSignedIn: auth.isSignedIn) }
            .navigationDestination(for: SavedList.self) { ListDetailView(list: $0) }
            .navigationDestination(for: MediaRef.self) { DetailView(tmdbId: $0.tmdbId, mediaType: $0.mediaType) }
        }
        .task(id: auth.isSignedIn) { await vm.load(isSignedIn: auth.isSignedIn) }
    }
}
