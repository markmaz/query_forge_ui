import { describe, expect, it } from "vitest";

import {
  createBlankDraft,
  createBlock,
  defaultAiRequiredActionsForPurpose,
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

  it("starts blank and creates action blocks from the selected purpose", () => {
    expect(createBlankDraft(new URLSearchParams("purpose=approval")).body_blocks).toEqual([]);
    expect(createBlock("action_buttons", "resource.display_name", "human_task")).toEqual({
      type: "action_buttons",
      actions: ["accept", "decline", "open_task"],
    });
  });

  it("defaults AI drafts to the response actions expected for each purpose", () => {
    expect(defaultAiRequiredActionsForPurpose("human_task")).toEqual(["accept", "decline"]);
    expect(defaultAiRequiredActionsForPurpose("notification")).toEqual(["open_task"]);
    expect(defaultAiRequiredActionsForPurpose("approval")).toEqual(["open_task"]);
    expect(defaultAiRequiredActionsForPurpose("report")).toEqual([]);
  });
});
