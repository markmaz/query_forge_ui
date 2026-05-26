import type { FlowForgeRunInspector, FlowForgeWorkflowDefinition } from "./types";

export const therapistRoutingStarterWorkflow: FlowForgeWorkflowDefinition = {
  id: "therapist-routing",
  name: "Therapist Intake Routing",
  description: "Starter workflow for matching intake records with eligible therapists and requesting a response.",
  status: "starter",
  graph: {
    nodes: [
      {
        id: "intake",
        type: "intake",
        label: "Patient Intake",
        position: { x: 40, y: 120 },
        data: { source: "", event: "" },
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
        label: "Request Response",
        position: { x: 860, y: 330 },
        data: { timeout_minutes: 120, task_mode: "sequential", communication_template_key: "flowforge.human_task" },
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
        type: "end",
        label: "Patient Assigned",
        position: { x: 300, y: 460 },
        data: { event_key: "patient_assigned" },
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

export const therapistRoutingDesignPreview: FlowForgeRunInspector = {
  workflow_id: "therapist-routing",
  mode: "design_preview",
  status: "ready",
  events: [
    {
      id: "evt-intake",
      event_type: "workflow.preview.intake",
      node_id: "intake",
      message: "Patient Intake is part of the design preview.",
      timestamp: "2026-05-04T10:00:00Z",
      data: { source: "" },
    },
    {
      id: "evt-match",
      event_type: "workflow.preview.matching",
      node_id: "match",
      message: "Matching will evaluate the selected resource pool and policy.",
      timestamp: "2026-05-04T10:00:01Z",
      data: { status: "preview" },
    },
    {
      id: "evt-response",
      event_type: "workflow.preview.human_task",
      node_id: "offer",
      message: "The response task will wait for accept, decline, or timeout.",
      timestamp: "2026-05-04T10:00:02Z",
      data: { timeout_minutes: 120 },
    },
  ],
  notes: [
    "This preview summarizes the workflow graph before runtime execution.",
    "Persisted run history is available from the run detail page after the workflow starts.",
  ],
};

export const emptyWorkflowDesignPreview: FlowForgeRunInspector = {
  workflow_id: "local-workflow",
  mode: "design_preview",
  status: "ready",
  events: [
    {
      id: "preview-start",
      event_type: "workflow.preview.intake",
      node_id: "start",
      message: "Start is part of the design preview.",
      timestamp: "2026-05-04T10:00:00Z",
      data: { status: "preview" },
    },
  ],
  notes: [
    "This preview summarizes the workflow graph before runtime execution.",
    "Persisted run history is available from the run detail page after the workflow starts.",
  ],
};
