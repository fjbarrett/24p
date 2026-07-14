import SwiftUI

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var publicLists: [SavedList] = []
    @Published var myLists: [SavedList] = []
    @Published var isLoading = false
    @Published var error: String?

    /// Bumped on every load so a newer load (e.g. sign-in flipping) supersedes
    /// an in-flight one instead of being skipped, and stale results are discarded.
    private var generation = 0

    func load(signedIn: Bool) async {
        generation += 1
        let token = generation
        isLoading = true
        error = nil

        // Best-effort: a failed personal-list load shouldn't hide public lists.
        let my = signedIn ? ((try? await APIClient.shared.myLists()) ?? []) : []
        guard token == generation, !Task.isCancelled else { return }
        myLists = my

        do {
            let lists = try await APIClient.shared.publicLists()
            guard token == generation, !Task.isCancelled else { return }
            publicLists = lists
        } catch {
            // A superseded task's cancellation must not paint an error.
            guard token == generation, !Task.isCancelled else { return }
            self.error = error.localizedDescription
        }
        if token == generation { isLoading = false }
    }
}

struct HomeView: View {
    @EnvironmentObject private var auth: AuthStore
    @StateObject private var vm = HomeViewModel()

    private let columns = [GridItem(.adaptive(minimum: 320, maximum: 380), spacing: 24)]

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading && vm.publicLists.isEmpty && vm.myLists.isEmpty {
                    ProgressView("Loading lists…")
                } else if let err = vm.error, vm.publicLists.isEmpty, vm.myLists.isEmpty {
                    ContentUnavailableView(
                        "Couldn't load lists",
                        systemImage: "exclamationmark.triangle",
                        description: Text(err)
                    )
                } else if vm.publicLists.isEmpty && vm.myLists.isEmpty {
                    ContentUnavailableView(
                        "No lists yet",
                        systemImage: "list.bullet",
                        description: Text(auth.isSignedIn
                            ? "Create a list on 24p.mov and it'll show up here."
                            : "No lists have been shared yet.")
                    )
                } else {
                    content
                }
            }
            .navigationTitle("24p")
        }
        // Reloads on first appear and whenever sign-in state flips.
        .task(id: auth.isSignedIn) { await vm.load(signedIn: auth.isSignedIn) }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                if !vm.myLists.isEmpty {
                    section(title: "Your Lists", lists: vm.myLists, owned: true)
                }
                if !vm.publicLists.isEmpty {
                    section(title: vm.myLists.isEmpty ? "Public Lists" : "Discover", lists: vm.publicLists, owned: false)
                }
            }
            .padding(48)
        }
    }

    private func section(title: String, lists: [SavedList], owned: Bool) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            Text(title)
                .font(.title2)
                .fontWeight(.bold)
                .padding(.leading, 4)

            LazyVGrid(columns: columns, spacing: 24) {
                ForEach(lists) { list in
                    NavigationLink {
                        ListDetailView(list: list, owned: owned)
                    } label: {
                        ListCard(list: list, width: 340)
                    }
                    .buttonStyle(.card)
                }
            }
        }
        .padding(.bottom, 32)
    }
}
