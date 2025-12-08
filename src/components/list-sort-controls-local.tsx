"use client";

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

export function ListSortControlsLocal({
  sort,
  dir,
  onChange,
}: {
  sort: string | null;
  dir: string | null;
  onChange: (sort: SortOption["value"], dir: "asc" | "desc") => void;
}) {
  const active = sort === "imdb" || sort === "letterboxd" || sort === "rating" ? sort : null;
  const direction = dir === "asc" || dir === "desc" ? dir : "desc";

  const setSort = (value: SortOption["value"]) => {
    if (!value) {
      onChange(null, direction);
      return;
    }
    const nextDir = value === active ? (direction === "desc" ? "asc" : "desc") : "desc";
    onChange(value, nextDir);
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
