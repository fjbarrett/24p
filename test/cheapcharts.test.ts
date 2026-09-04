import { describe, expect, test } from "bun:test";
import { parseCheapChartsCustomLists, selectCheapChartsMovie } from "@/lib/cheapcharts";

describe("CheapCharts response handling", () => {
  test("extracts and de-duplicates custom list summaries from nested responses", () => {
    expect(
      parseCheapChartsCustomLists({
        status: "success",
        results: {
          lists: [
            { ID: 9, title: "Watch next", itemCount: 12 },
            { listId: "7", listName: "Buy in 4K", count: 3 },
            { ID: 9, title: "Watch next" },
            { itemID: 123, id: 44, title: "A movie, not a list" },
          ],
        },
      }),
    ).toEqual([
      { id: "7", title: "Buy in 4K", itemCount: 3 },
      { id: "9", title: "Watch next", itemCount: 12 },
    ]);
  });

  test("prefers IMDb identity over similarly named store results", () => {
    const selected = selectCheapChartsMovie(
      [
        { idInStore: "1", title: "Heat", releaseYear: 1986, imdbId: "tt0093164", itemType: "movie" },
        { idInStore: "2", title: "Heat", releaseYear: 1995, imdbId: "tt0113277", itemType: "movie" },
      ],
      { title: "Heat", releaseYear: 1995, imdbId: "tt0113277" },
    );
    expect(selected?.idInStore).toBe("2");
  });

  test("does not guess when duplicate title matches remain ambiguous", () => {
    const selected = selectCheapChartsMovie(
      [
        { idInStore: "1", title: "The Gift", itemType: "movie" },
        { idInStore: "2", title: "The Gift", itemType: "movie" },
      ],
      { title: "The Gift" },
    );
    expect(selected).toBeNull();
  });
});
