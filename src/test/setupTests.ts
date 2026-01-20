import "@testing-library/jest-dom";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";
import { resetLastQueryPayload } from "./msw/handlers";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  resetLastQueryPayload();
});

afterAll(() => {
  server.close();
});
