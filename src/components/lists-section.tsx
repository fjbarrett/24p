"use client";

import { useEffect, useMemo, useState } from "react";
import { Cog, Plus, Save, X } from "lucide-react";
import { CreateListButton } from "@/components/create-list-button";
import { ImportListModal } from "@/components/import-list-modal";
import { ListGallery } from "@/components/list-gallery";
import { ListMoviesGrid } from "@/components/list-movies-grid";
import { ListSortControlsLocal } from "@/components/list-sort-controls-local";
import type { SavedList } from "@/lib/list-store";
import type { SimplifiedMovie } from "@/lib/tmdb";
import { rustApiFetch } from "@/lib/rust-api-client";
import {
  deleteSmartList,
  loadSmartLists,
  ruleSummary,
  saveSmartList,
  type SmartListDefinition,
  type SmartRule,
  type SmartRuleType,
} from "@/lib/smart-list-store";

type ListsSectionProps = {
  lists: SavedList[];
  userEmail: string;
};

type DraftRule = {
  id: string;
  type: SmartRuleType;
  value: string;
};

export function ListsSection({ lists, userEmail }: ListsSectionProps) {
  const [smartLists, setSmartLists] = useState<SmartListDefinition[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewSort, setViewSort] = useState<string | null>(null);
  const [viewDir, setViewDir] = useState<string | null>(null);
  const [title, setTitle] = useState("Smart festival lineup");
  const [draftRules, setDraftRules] = useState<DraftRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedSmartId, setSelectedSmartId] = useState<string | null>(null);
  const [viewSmartId, setViewSmartId] = useState<string | null>(null);
  const [matches, setMatches] = useState<SimplifiedMovie[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);

  useEffect(() => {
    if (!userEmail) return;
    setSmartLists(loadSmartLists(userEmail));
  }, [userEmail]);

  useEffect(() => {
    if (!viewSmartId) return;
    const target = smartLists.find((entry) => entry.id === viewSmartId);
    if (!target) return;
    setIsLoadingMatches(true);
    (async () => {
      const candidateIds = collectCandidateIds(target, lists);
      if (!candidateIds.length) {
        setMatches([]);
        setIsLoadingMatches(false);
        return;
      }
      const details = await fetchDetails(candidateIds);
      const filtered = filterMovies(details, target.rules);
      setMatches(filtered);
      if (typeof window !== "undefined") {
        filtered.forEach((movie) => {
          try {
            window.sessionStorage.setItem(`tmdb:${movie.tmdbId}`, JSON.stringify(movie));
          } catch {
            // ignore
          }
        });
      }
      setIsLoadingMatches(false);
    })();
  }, [viewSmartId, smartLists, lists]);

  const combinedEntries = useMemo(() => {
    const formattedSmart = smartLists.map((entry) => ({
      ...entry,
      isSmart: true,
    }));
    return [...lists, ...formattedSmart].sort((a, b) => {
      const aDate = new Date((a as SavedList).createdAt ?? (a as SmartListDefinition).createdAt).getTime();
      const bDate = new Date((b as SavedList).createdAt ?? (b as SmartListDefinition).createdAt).getTime();
      return bDate - aDate;
    });
  }, [lists, smartLists]);

  function openCreate() {
    setTitle("Smart festival lineup");
    setDraftRules([
      {
        id: crypto.randomUUID?.() ?? `rule-${Date.now()}`,
        type: "list",
        value: lists[0]?.id ?? "",
      },
    ]);
    setError(null);
    setIsCreateOpen(true);
  }

  function openEdit(smartList: SmartListDefinition) {
    setTitle(smartList.title);
    setDraftRules(
      smartList.rules.map((rule) => ({
        id: rule.id,
        type: rule.type,
        value: rule.value,
      })),
    );
    setError(null);
    setIsEditOpen(true);
    setSelectedSmartId(smartList.id);
  }

  function updateRule(id: string, updater: (rule: DraftRule) => DraftRule) {
    setDraftRules((prev) => prev.map((rule) => (rule.id === id ? updater(rule) : rule)));
  }

  function addRule() {
    const firstList = lists[0]?.id ?? "";
    setDraftRules((prev) => [
      ...prev,
      {
        id: crypto.randomUUID?.() ?? `rule-${Date.now()}-${prev.length + 1}`,
        type: "list",
        value: firstList,
      },
    ]);
  }

  function removeRule(id: string) {
    setDraftRules((prev) => prev.filter((rule) => rule.id !== id));
  }

  function handleSave(mode: "create" | "edit") {
    const email = userEmail.trim().toLowerCase();
    if (!email) {
      setError("Sign in to save smart lists.");
      return;
    }
    if (!draftRules.length) {
      setError("Add at least one rule.");
      return;
    }
    const normalizedRules = draftRules
      .filter((rule) => rule.value.trim())
      .map<SmartRule>((rule) => ({
        ...rule,
        value: rule.value.trim(),
      }));
    const hasListRule = normalizedRules.some((rule) => rule.type === "list");
    if (!hasListRule) {
      setError("Include at least one list rule so we know where to pull movies from.");
      return;
    }
    const name = title.trim() || "Smart list";
    setSaving(true);
    const existing = mode === "edit" ? smartLists.find((entry) => entry.id === selectedSmartId) : undefined;
    const smartId = existing?.id ?? crypto.randomUUID?.() ?? `smart-${Date.now()}`;
    const newSmartList: SmartListDefinition = {
      id: smartId,
      title: name,
      rules: normalizedRules,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    const updated = saveSmartList(newSmartList, email);
    setSmartLists(updated);
    setSaving(false);
    setIsCreateOpen(false);
    setIsEditOpen(false);
    setSelectedSmartId(smartId);
    setError(null);
    if (isViewOpen) {
      setViewSmartId(smartId);
    }
  }

  function handleDelete(id: string) {
    const email = userEmail.trim().toLowerCase();
    if (!email) return;
    const updated = deleteSmartList(id, email);
    setSmartLists(updated);
    if (selectedSmartId === id) {
      setSelectedSmartId(null);
      setIsEditOpen(false);
    }
    if (viewSmartId === id) {
      setViewSmartId(null);
      setIsViewOpen(false);
      setMatches([]);
    }
  }

  const ruleOptions = useMemo(
    () => [
      { value: "list", label: "Movies from list" },
      { value: "year", label: "Release year" },
      { value: "genre", label: "Genre" },
      { value: "rating", label: "TMDB rating at least" },
    ],
    [],
  );

  return (
    <div className="space-y-4 rounded-3xl bg-black-900/30 p-4 backdrop-blur sm:space-y-6 sm:p-6" id="lists">
      <CreateListButton userEmail={userEmail} />
      <button
        type="button"
        onClick={openCreate}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-base font-semibold text-black shadow-lg shadow-black-800/30 transition hover:brightness-95"
      >
        <Plus size={16} />
        Create smart list
      </button>
      <ListGallery
        lists={combinedEntries}
        onSmartListSelect={(id) => {
          const found = smartLists.find((entry) => entry.id === id);
          if (found) {
            setViewSmartId(id);
            setIsViewOpen(true);
            setViewSort(null);
            setViewDir(null);
          }
        }}
        onSmartListEdit={(id) => {
          const found = smartLists.find((entry) => entry.id === id);
          if (found) {
            openEdit(found);
          }
        }}
      />
      <ImportListModal />

      {(isCreateOpen || isEditOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4" role="dialog" aria-modal>
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-black p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {isEditOpen ? "Edit smart list" : "Create smart list"}
                </h3>
                <p className="text-sm text-black-400">
                  Combine rules to auto-assemble movies by list, release year, genre, or rating threshold.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setIsEditOpen(false);
                }}
                className="rounded-full border border-black-700 p-2 text-black-400 transition hover:border-black-500 hover:text-white"
                aria-label="Close smart list modal"
              >
                <X size={18} />
              </button>
            </div>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleSave(isEditOpen ? "edit" : "create");
              }}
            >
              <label className="block text-sm text-black-300">
                Title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-black-700 bg-black-950 px-3 py-2 text-base text-black-100 focus:border-black-400 focus:outline-none"
                  maxLength={72}
                  placeholder="e.g. 90s horror across my lists"
                />
              </label>

              <div className="space-y-3">
                {draftRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-black-950/80 p-3 sm:flex-row sm:items-center"
                  >
                    <select
                      value={rule.type}
                      onChange={(event) =>
                        updateRule(rule.id, (current) => ({
                          ...current,
                          type: event.target.value as SmartRuleType,
                          value: event.target.value === "list" ? lists[0]?.id ?? "" : "",
                        }))
                      }
                      className="w-full rounded-xl border border-black-700 bg-black px-3 py-2 text-sm text-black-100 focus:border-black-400 focus:outline-none sm:w-44"
                    >
                      {ruleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    {rule.type === "list" && (
                      <select
                        value={rule.value}
                        onChange={(event) =>
                          updateRule(rule.id, (current) => ({ ...current, value: event.target.value }))
                        }
                        className="w-full rounded-xl border border-black-700 bg-black px-3 py-2 text-sm text-black-100 focus:border-black-400 focus:outline-none"
                      >
                        {lists.map((list) => (
                          <option key={list.id} value={list.id}>
                            {list.title}
                          </option>
                        ))}
                      </select>
                    )}
                    {rule.type === "year" && (
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={rule.value}
                        onChange={(event) =>
                          updateRule(rule.id, (current) => ({ ...current, value: event.target.value }))
                        }
                        placeholder="1999"
                        className="w-full rounded-xl border border-black-700 bg-black px-3 py-2 text-sm text-black-100 focus:border-black-400 focus:outline-none"
                      />
                    )}
                    {rule.type === "genre" && (
                      <input
                        value={rule.value}
                        onChange={(event) =>
                          updateRule(rule.id, (current) => ({ ...current, value: event.target.value }))
                        }
                        placeholder="Horror"
                        className="w-full rounded-xl border border-black-700 bg-black px-3 py-2 text-sm text-black-100 focus:border-black-400 focus:outline-none"
                      />
                    )}
                    {rule.type === "rating" && (
                      <input
                        inputMode="decimal"
                        value={rule.value}
                        onChange={(event) =>
                          updateRule(rule.id, (current) => ({ ...current, value: event.target.value }))
                        }
                        placeholder="7.7"
                        className="w-full rounded-xl border border-black-700 bg-black px-3 py-2 text-sm text-black-100 focus:border-black-400 focus:outline-none"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeRule(rule.id)}
                      className="self-start rounded-full border border-black-700 p-2 text-black-400 transition hover:border-black-500 hover:text-white sm:self-center"
                      aria-label="Remove rule"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addRule}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-black-700 px-3 py-2 text-sm text-black-200 transition hover:border-black-500"
                >
                  <Plus size={16} />
                  Add rule
                </button>
              </div>

              {error && <p className="text-sm text-rose-400">{error}</p>}

              <div className="flex items-center justify-end gap-2">
                {isEditOpen && selectedSmartId && (
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedSmartId)}
                    className="rounded-full border border-black-700 px-4 py-2 text-sm text-rose-300 transition hover:border-rose-400"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setIsEditOpen(false);
                  }}
                  className="rounded-full border border-black-700 px-4 py-2 text-sm text-black-200 transition hover:border-black-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black shadow-lg shadow-black-800/30 transition hover:brightness-95 disabled:opacity-60"
                >
                  {saving ? "Saving..." : isEditOpen ? "Save changes" : "Save smart list"}
                  {isEditOpen ? <Save size={14} /> : <Plus size={14} />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isViewOpen && viewSmartId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-[1000px] space-y-6 rounded-3xl bg-black-900/70 p-6 shadow-2xl backdrop-blur">
            <div className="flex justify-left">
              <button
                onClick={() => {
                  setIsViewOpen(false);
                  setViewSmartId(null);
                  setMatches([]);
                }}
                className="rounded-full px-4 py-2 text-sm text-black-200"
              >
                <span>Back</span>
              </button>
            </div>
            <div className="flex items-center justify-between" style={{ paddingLeft: 16 }}>
              <h1 className="text-3xl font-semibold text-white">
                {smartLists.find((entry) => entry.id === viewSmartId)?.title ?? "Smart list"}
              </h1>
              <button
                onClick={() => {
                  const target = smartLists.find((entry) => entry.id === viewSmartId);
                  if (target) {
                    openEdit(target);
                  }
                }}
                className="flex items-center gap-2 rounded-full border border-black-600 bg-black-800 px-4 py-2 text-sm text-black-100 transition hover:border-black-400"
              >
                <Cog size={18} />
                Edit rules
              </button>
            </div>
            <ListSortControlsLocal sort={viewSort} dir={viewDir} onChange={(nextSort, nextDir) => {
              setViewSort(nextSort);
              setViewDir(nextDir);
            }} />
            <section className="space-y-3">
              {isLoadingMatches ? (
                <p className="text-sm text-black-400" style={{ paddingLeft: 16 }}>
                  Loading matches...
                </p>
              ) : matches.length === 0 ? (
                <p className="text-sm text-black-400" style={{ paddingLeft: 16 }}>
                  No movies matched these rules yet.
                </p>
              ) : (
                <ListMoviesGrid
                  tmdbIds={matches.map((movie) => movie.tmdbId)}
                  ratingsMap={{}}
                  sort={viewSort}
                  dir={viewDir}
                  fromParam={encodeURIComponent(`/smart/${viewSmartId}`)}
                  listSlug={`smart-${viewSmartId}`}
                  listTitle={smartLists.find((entry) => entry.id === viewSmartId)?.title ?? "Smart list"}
                  listId={undefined}
                  userEmail={userEmail}
                  isEditing={false}
                />
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function collectCandidateIds(smartList: SmartListDefinition, lists: SavedList[]) {
  const ids = new Set<number>();
  smartList.rules
    .filter((rule) => rule.type === "list" && rule.value)
    .forEach((rule) => {
      const source = lists.find((entry) => entry.id === rule.value || entry.slug === rule.value);
      source?.movies?.forEach((id) => ids.add(id));
    });
  return Array.from(ids);
}

function filterMovies(movies: SimplifiedMovie[], rules: SmartRule[]) {
  const years = rules
    .filter((rule) => rule.type === "year" && rule.value.trim())
    .map((rule) => Number(rule.value))
    .filter((year) => !Number.isNaN(year));
  const genres = rules
    .filter((rule) => rule.type === "genre" && rule.value.trim())
    .map((rule) => rule.value.trim().toLowerCase());
  const ratingThreshold = rules
    .filter((rule) => rule.type === "rating" && rule.value.trim())
    .map((rule) => Number(rule.value))
    .find((value) => !Number.isNaN(value));

  return movies.filter((movie) => {
    if (years.length && (!movie.releaseYear || !years.includes(movie.releaseYear))) {
      return false;
    }
    if (genres.length) {
      const movieGenres = (movie.genres ?? []).map((genre) => genre.toLowerCase());
      const hasGenre = genres.some((genre) => movieGenres.includes(genre));
      if (!hasGenre) return false;
    }
    if (typeof ratingThreshold === "number") {
      if (typeof movie.rating !== "number" || movie.rating < ratingThreshold) {
        return false;
      }
    }
    return true;
  });
}

async function fetchDetails(tmdbIds: number[]): Promise<SimplifiedMovie[]> {
  const cached: SimplifiedMovie[] = [];
  const missing: number[] = [];
  tmdbIds.forEach((id) => {
    const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(`tmdb:${id}`) : null;
    if (raw) {
      try {
        cached.push(JSON.parse(raw) as SimplifiedMovie);
        return;
      } catch {
        // fall through if cache parsing fails
      }
    }
    missing.push(id);
  });

  const fetched: SimplifiedMovie[] = [];
  const concurrency = 6;
  for (let i = 0; i < missing.length; i += concurrency) {
    const chunk = missing.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      chunk.map((id) => rustApiFetch<{ detail: SimplifiedMovie }>(`/tmdb/movie/${id}`)),
    );
    results.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value?.detail) {
        fetched.push(result.value.detail);
        try {
          window.sessionStorage.setItem(`tmdb:${chunk[index]}`, JSON.stringify(result.value.detail));
        } catch {
          // ignore cache errors
        }
      }
    });
  }

  return [...cached, ...fetched];
}
