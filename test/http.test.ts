import { describe, expect, test } from "bun:test";
import { PublicHttpError, publicError, routeError } from "@/lib/server/http";

describe("publicError", () => {
  test("throws a PublicHttpError carrying the status", () => {
    try {
      publicError("List not found", 404);
      throw new Error("expected publicError to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(PublicHttpError);
      expect((error as PublicHttpError).status).toBe(404);
      expect((error as PublicHttpError).message).toBe("List not found");
    }
  });
});

describe("routeError", () => {
  test("surfaces PublicHttpError message and status to the client", async () => {
    const response = routeError("test", new PublicHttpError("username not found", 404), "Generic");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "username not found" });
  });

  test("hides internal error details behind the generic message", async () => {
    const response = routeError(
      "test",
      new Error('password authentication failed for user "app"'),
      "Something went wrong",
    );
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Something went wrong");
    expect(JSON.stringify(body)).not.toContain("password");
  });
});
