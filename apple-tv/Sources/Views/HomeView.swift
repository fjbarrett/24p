import SwiftUI

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var lists: [SavedList] = []
    @Published var isLoading = false
    @Published var error: String?

    func load() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        do {
            lists = try await APIClient.shared.publicLists()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

struct HomeView: View {
    @StateObject private var vm = HomeViewModel()
    @State private var selectedList: SavedList?

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading {
                    ProgressView("Loading lists…")
                } else if let err = vm.error {
                    ContentUnavailableView(
                        "Couldn't load lists",
                        systemImage: "exclamationmark.triangle",
                        description: Text(err)
                    )
                } else if vm.lists.isEmpty {
                    ContentUnavailableView(
                        "No public lists",
                        systemImage: "list.bullet",
                        description: Text("No lists have been shared yet.")
                    )
                } else {
                    listsGrid
                }
            }
            .navigationTitle("24p")
            .navigationDestination(item: $selectedList) { list in
                if let username = list.username {
                    ListDetailView(username: username, slug: list.slug, initialList: list)
                }
            }
        }
        .task { await vm.load() }
    }

    private var listsGrid: some View {
        ScrollView {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 320, maximum: 380), spacing: 24)],
                spacing: 24
            ) {
                ForEach(vm.lists) { list in
                    Button {
                        selectedList = list
                    } label: {
                        ListCard(list: list, width: 340)
                    }
                    .buttonStyle(.card)
                }
            }
            .padding(48)
        }
    }
}
