import { describe, expect, it } from "vitest";

import {
  createBlankDraft,
  createBlock,
  getActionsForPurpose,
  sanitizeActionsForPurpose,
  sanitizeBlocksForPurpose,
} from "../model/communicationTemplateBuilder";

describe("communicationTemplateBuilder action contracts", () => {
  it("exposes only runtime-backed email actions for each template purpose", () => {
    expect(getActionsForPurpose("human_task")).toEqual(["accept", "decline", "open_task"]);
    expect(getActionsForPurpose("approval")).toEqual(["open_task"]);
    expect(getActionsForPurpose("notification")).toEqual(["open_task"]);
    expect(getActionsForPurpose("alert")).toEqual(["open_task"]);
    expect(getActionsForPurpose("report")).toEqual([]);
  });

  it("sanitizes action blocks when the template purpose changes", () => {
    expect(sanitizeActionsForPurpose(["accept", "decline", "open_task"], "approval")).toEqual(["open_task"]);
    expect(
      sanitizeBlocksForPurpose(
        [
          { type: "text", content: "Review the task." },
          { type: "action_buttons", actions: ["accept", "decline", "open_task"] },
        ],
        "report",
      ),
    ).toEqual([
      { type: "text", content: "Review the task." },
      { type: "action_buttons", actions: [] },
    ]);
  });

  it("creates default action blocks from the selected purpose", () => {
    expect(createBlankDraft(new URLSearchParams("purpose=approval")).body_blocks).toContainEqual({
      type: "action_buttons",
      actions: ["open_task"],
    });
    expect(createBlock("action_buttons", "resource.display_name", "human_task")).toEqual({
      type: "action_buttons",
      actions: ["accept", "decline", "open_task"],
    });
  });
});
