import type { SavedList } from "@/lib/list-store";

export type SmartRuleType = "list" | "year" | "genre" | "rating";

export type SmartRule = {
  id: string;
  type: SmartRuleType;
  value: string;
};

export type SmartListDefinition = {
  id: string;
  title: string;
  rules: SmartRule[];
  createdAt: string;
};

function keyForUser(userEmail: string) {
  return `smart-lists:${userEmail.trim().toLowerCase()}`;
}

function safeParseSmartLists(raw: string | null): SmartListDefinition[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SmartListDefinition[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => ({
      ...entry,
      rules: Array.isArray(entry.rules) ? entry.rules.filter((rule) => rule?.type && rule?.value) : [],
    }));
  } catch {
    return [];
  }
}

export function loadSmartLists(userEmail: string): SmartListDefinition[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(keyForUser(userEmail));
  return safeParseSmartLists(raw);
}

export function saveSmartList(list: SmartListDefinition, userEmail: string): SmartListDefinition[] {
  if (typeof window === "undefined") return [];
  const key = keyForUser(userEmail);
  const existing = safeParseSmartLists(window.localStorage.getItem(key));
  const updated = [list, ...existing.filter((entry) => entry.id !== list.id)];
  try {
    window.localStorage.setItem(key, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
  return updated;
}

export function deleteSmartList(id: string, userEmail: string): SmartListDefinition[] {
  if (typeof window === "undefined") return [];
  const key = keyForUser(userEmail);
  const existing = safeParseSmartLists(window.localStorage.getItem(key));
  const updated = existing.filter((entry) => entry.id !== id);
  try {
    window.localStorage.setItem(key, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
  return updated;
}

export function ruleSummary(rule: SmartRule, lists: SavedList[]): string {
  if (rule.type === "list") {
    const match = lists.find((entry) => entry.id === rule.value || entry.slug === rule.value);
    return match ? `Movies in "${match.title}"` : "Movies from a list";
  }
  if (rule.type === "year") {
    return `Release year is ${rule.value}`;
  }
  if (rule.type === "genre") {
    return `Genre includes ${rule.value}`;
  }
  if (rule.type === "rating") {
    return `TMDB rating is at least ${rule.value}`;
  }
  return "";
}
