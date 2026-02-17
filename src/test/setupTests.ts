import "@testing-library/jest-dom";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";
import { resetExecutionTracking, resetJoinStore, resetLastQueryPayload } from "./msw/handlers";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  resetLastQueryPayload();
  resetExecutionTracking();
  resetJoinStore();
});

afterAll(() => {
  server.close();
});
