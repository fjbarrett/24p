import { describe, expect, test } from "bun:test";
import { clientIp } from "@/lib/server/client-ip";

describe("clientIp", () => {
  test("prefers cf-connecting-ip over everything else", () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.7",
      "x-real-ip": "198.51.100.1",
      "x-forwarded-for": "6.6.6.6",
    });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  test("falls back to x-real-ip", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.1", "x-forwarded-for": "6.6.6.6" });
    expect(clientIp(headers)).toBe("198.51.100.1");
  });

  test("uses the rightmost x-forwarded-for hop, never the spoofable leftmost", () => {
    const headers = new Headers({ "x-forwarded-for": "6.6.6.6, 10.0.0.1, 172.16.0.9" });
    expect(clientIp(headers)).toBe("172.16.0.9");
  });

  test("returns unknown when no addressing headers exist", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
