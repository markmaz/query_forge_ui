import type { FlowForgeRunInspector, FlowForgeWorkflowDefinition } from "./types";

export const therapistRoutingSeed: FlowForgeWorkflowDefinition = {
  id: "therapist-routing",
  name: "Therapist Intake Routing",
  description: "Sequential offer workflow for matching patients with eligible therapists.",
  status: "draft",
  graph: {
    nodes: [
      {
        id: "intake",
        type: "intake",
        label: "Patient Intake",
        position: { x: 40, y: 120 },
        data: { source: "Jotform", event: "intake_submitted" },
      },
      {
        id: "match",
        type: "matching",
        label: "Find Matching Therapist",
        position: { x: 360, y: 90 },
        data: { matching_policy_id: "" },
      },
      {
        id: "offer",
        type: "human_task",
        label: "Send Offer",
        position: { x: 860, y: 330 },
        data: { timeout_minutes: 120, offer_mode: "sequential", communication_template_key: "flowforge.human_task" },
      },
      {
        id: "decision",
        type: "decision",
        label: "Accepted?",
        position: { x: 580, y: 330 },
        data: { outcomes: ["accepted", "declined", "timed_out"] },
      },
      {
        id: "assign",
        type: "assignment",
        label: "Assign Patient",
        position: { x: 300, y: 460 },
        data: { terminal: true, reporting_event: "patient_assigned" },
      },
      {
        id: "decline",
        type: "event_capture",
        label: "Capture Decline Reason",
        position: { x: 580, y: 560 },
        data: { captures: ["decline_reason", "response_time", "timeout"] },
      },
      {
        id: "next",
        type: "iterator",
        label: "Next Therapist",
        position: { x: 860, y: 560 },
        data: { loop_target: "offer", stop_when: "candidate_pool_exhausted" },
      },
    ],
    edges: [
      { id: "intake-match", source: "intake", target: "match" },
      { id: "match-offer", source: "match", target: "offer", label: "Matched", branch: "matched" },
      { id: "match-decline", source: "match", target: "decline", label: "No match", branch: "no_match" },
      { id: "offer-decision", source: "offer", target: "decision" },
      { id: "decision-assign", source: "decision", target: "assign", label: "Accepted" },
      { id: "decision-decline", source: "decision", target: "decline", label: "Declined/Timed out" },
      { id: "decline-next", source: "decline", target: "next" },
      { id: "next-offer", source: "next", target: "offer", label: "Loop" },
    ],
  },
};

export const therapistRoutingRunInspector: FlowForgeRunInspector = {
  workflow_id: "therapist-routing",
  mode: "placeholder",
  status: "not_started",
  events: [
    {
      id: "evt-intake",
      event_type: "workflow.run.started",
      node_id: "intake",
      message: "Intake received from Jotform.",
      timestamp: "2026-05-04T10:00:00Z",
      data: { source: "Jotform" },
    },
    {
      id: "evt-eligibility",
      event_type: "workflow.node.pending",
      node_id: "eligible",
      message: "Eligibility filtering is ready for execution.",
      timestamp: "2026-05-04T10:00:01Z",
      data: { status: "placeholder" },
    },
    {
      id: "evt-offer",
      event_type: "workflow.human_task.waiting",
      node_id: "offer",
      message: "Offer loop will wait for therapist accept, decline, or timeout.",
      timestamp: "2026-05-04T10:00:02Z",
      data: { timeout_minutes: 120 },
    },
  ],
  notes: [
    "Runtime persistence is intentionally not implemented yet.",
    "Future execution should persist state transitions and events before dispatching side effects.",
  ],
};
