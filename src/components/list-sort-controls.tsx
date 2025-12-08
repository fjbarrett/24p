"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SortOption = {
  value: "rating" | "imdb" | "letterboxd" | null;
  label: string;
};

const options: SortOption[] = [
  { value: null, label: "List order" },
  { value: "rating", label: "List rating" },
  { value: "imdb", label: "IMDb rating" },
  { value: "letterboxd", label: "Letterboxd rating" },
];

export function ListSortControls({ sort, dir }: { sort?: string | null; dir?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = useMemo(() => {
    if (sort === "imdb" || sort === "letterboxd" || sort === "rating") return sort;
    return null;
  }, [sort]);

  const direction = dir === "asc" || dir === "desc" ? dir : "desc";

  const setSort = (value: SortOption["value"]) => {
    const params = new URLSearchParams(searchParams?.toString());
    if (!value) {
      params.delete("sort");
      params.delete("dir");
    } else {
      params.set("sort", value);
      const nextDir = value === active ? (direction === "desc" ? "asc" : "desc") : "desc";
      params.set("dir", nextDir);
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-wrap gap-2" style={{ paddingLeft: 16 }}>
      {options.map((option) => {
        const isActive = active === option.value;
        const indicator = isActive ? (direction === "desc" ? " ↓" : " ↑") : "";
        return (
          <button
            key={option.label}
            type="button"
            onClick={() => setSort(option.value)}
            aria-pressed={isActive}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              isActive
                ? "border-black-300 bg-black-700 text-white"
                : "border-black-700 text-black-300 hover:border-black-500 hover:text-white"
            }`}
          >
            {option.label}
            {indicator}
          </button>
        );
      })}
    </div>
  );
}
