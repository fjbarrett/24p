import { mock } from "bun:test";

// `server-only` is a poison-pill package that throws when imported outside a
// React Server Component; neutralize it so server modules can be tested.
mock.module("server-only", () => ({}));
