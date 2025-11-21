import type { CSSProperties } from "react";

export type ListColorOption = {
  id: string;
  label: string;
  surface: string;
  overlay: string;
  ring: string;
};

export const LIST_COLOR_OPTIONS: ListColorOption[] = [
  {
    id: "sky",
    label: "Sky",
    surface: "rgba(12, 74, 110, 0.55)",
    overlay: "linear-gradient(135deg, rgba(56, 189, 248, 0.42), rgba(30, 64, 175, 0.30))",
    ring: "rgb(125, 211, 252)",
  },
  {
    id: "emerald",
    label: "Emerald",
    surface: "rgba(5, 46, 22, 0.55)",
    overlay: "linear-gradient(135deg, rgba(34, 197, 94, 0.42), rgba(16, 185, 129, 0.30))",
    ring: "rgb(74, 222, 128)",
  },
  {
    id: "amber",
    label: "Amber",
    surface: "rgba(69, 26, 3, 0.55)",
    overlay: "linear-gradient(135deg, rgba(251, 146, 60, 0.40), rgba(234, 179, 8, 0.28))",
    ring: "rgb(253, 186, 116)",
  },
  {
    id: "violet",
    label: "Violet",
    surface: "rgba(49, 21, 88, 0.55)",
    overlay: "linear-gradient(135deg, rgba(167, 139, 250, 0.42), rgba(99, 102, 241, 0.30))",
    ring: "rgb(196, 181, 253)",
  },
  {
    id: "rose",
    label: "Rose",
    surface: "rgba(76, 5, 25, 0.55)",
    overlay: "linear-gradient(135deg, rgba(244, 114, 182, 0.42), rgba(244, 63, 94, 0.30))",
    ring: "rgb(251, 113, 133)",
  },
  {
    id: "indigo",
    label: "Indigo",
    surface: "rgba(31, 27, 75, 0.55)",
    overlay: "linear-gradient(135deg, rgba(129, 140, 248, 0.42), rgba(99, 102, 241, 0.30))",
    ring: "rgb(165, 180, 252)",
  },
  {
    id: "slate",
    label: "Slate",
    surface: "rgba(15, 23, 42, 0.65)",
    overlay: "linear-gradient(135deg, rgba(148, 163, 184, 0.36), rgba(30, 41, 59, 0.32))",
    ring: "rgb(148, 163, 184)",
  },
];

export const DEFAULT_LIST_COLOR_ID = LIST_COLOR_OPTIONS[0]?.id ?? "sky";

export function normalizeListColor(color?: string | null): string {
  if (!color) return DEFAULT_LIST_COLOR_ID;
  const trimmed = color.trim().toLowerCase();
  return LIST_COLOR_OPTIONS.some((option) => option.id === trimmed) ? trimmed : DEFAULT_LIST_COLOR_ID;
}

export function getListColorStyles(color?: string | null): {
  surface: CSSProperties;
  overlay: CSSProperties;
  option?: ListColorOption;
} {
  const normalized = normalizeListColor(color);
  const choice = LIST_COLOR_OPTIONS.find((entry) => entry.id === normalized) ?? LIST_COLOR_OPTIONS[0];
  return {
    surface: { backgroundColor: choice.surface },
    overlay: { backgroundImage: choice.overlay },
    option: choice,
  };
}
