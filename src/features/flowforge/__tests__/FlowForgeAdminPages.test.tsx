import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getFlowForgeDatasetArtifact,
  listFlowForgeDataDestinations,
  listFlowForgeDataMovementAudit,
  listFlowForgeDataSources,
  listFlowForgeDatasetArtifacts,
  testFlowForgeDataDestination,
  testFlowForgeDataSource,
  updateFlowForgeDataDestination,
  updateFlowForgeDataSource,
  upsertFlowForgeDataDestination,
  upsertFlowForgeDataSource,
} from "../api/dataMovementApi";
import {
  createFlowForgeMatchingPolicyLLMDraft,
  createFlowForgeMatchingPolicy,
  createFlowForgeResourceSet,
  createJotformIntegration,
  createManualResourceSnapshot,
  deleteFlowForgeResourceRecord,
  deleteFlowForgeResourceSet,
  deleteFlowForgeMatchingPolicy,
  deleteFlowForgeMatchingPolicyVersion,
  getFlowForgeSettings,
  listFlowForgeIntegrations,
  listFlowForgeMatchingPolicies,
  listFlowForgeMatchingPolicyVersions,
  listFlowForgeResourceRecords,
  listFlowForgeResourceSets,
  listIntegrationTriggers,
  simulateFlowForgeMatchingPolicy,
  updateFlowForgeResourceRecord,
  updateFlowForgeResourceSet,
  updateFlowForgeSettings,
} from "../api/adminApi";
import {
  activateFlowForgeCommunicationTemplate,
  createFlowForgeCommunicationTemplateAIDraft,
  createFlowForgeCommunicationTemplate,
  listFlowForgeCommunicationTemplates,
  updateFlowForgeCommunicationTemplate,
  validateFlowForgeCommunicationTemplate,
} from "../api/communicationTemplatesApi";
import FlowForgeDataMovementPage from "../ui/FlowForgeDataMovementPage";
import FlowForgeCommunicationTemplatesPage from "../ui/FlowForgeCommunicationTemplatesPage";
import FlowForgeIntegrationsPage from "../ui/FlowForgeIntegrationsPage";
import FlowForgeMatchingPoliciesPage from "../ui/FlowForgeMatchingPoliciesPage";
import FlowForgeResourcesPage from "../ui/FlowForgeResourcesPage";
import FlowForgeSettingsPage from "../ui/FlowForgeSettingsPage";

vi.mock("../api/adminApi", () => ({
  createFlowForgeMatchingPolicyLLMDraft: vi.fn(),
  createFlowForgeMatchingPolicy: vi.fn(),
  createFlowForgeResourceSet: vi.fn(),
  createIntegrationTrigger: vi.fn(),
  createJotformIntegration: vi.fn(),
  createManualResourceSnapshot: vi.fn(),
  deleteFlowForgeResourceRecord: vi.fn(),
  deleteFlowForgeResourceSet: vi.fn(),
  deleteFlowForgeMatchingPolicy: vi.fn(),
  deleteFlowForgeMatchingPolicyVersion: vi.fn(),
  getFlowForgeSettings: vi.fn(),
  listFlowForgeIntegrations: vi.fn(),
  listFlowForgeMatchingPolicies: vi.fn(),
  listFlowForgeMatchingPolicyVersions: vi.fn(),
  listFlowForgeResourceRecords: vi.fn(),
  listFlowForgeResourceSets: vi.fn(),
  listIntegrationTriggers: vi.fn(),
  simulateFlowForgeMatchingPolicy: vi.fn(),
  updateFlowForgeResourceRecord: vi.fn(),
  updateFlowForgeResourceSet: vi.fn(),
  updateFlowForgeSettings: vi.fn(),
}));

vi.mock("../api/communicationTemplatesApi", () => ({
  activateFlowForgeCommunicationTemplate: vi.fn(),
  createFlowForgeCommunicationTemplateAIDraft: vi.fn(),
  createFlowForgeCommunicationTemplate: vi.fn(),
  listFlowForgeCommunicationTemplates: vi.fn(),
  updateFlowForgeCommunicationTemplate: vi.fn(),
  validateFlowForgeCommunicationTemplate: vi.fn(),
}));

vi.mock("../api/dataMovementApi", () => ({
  getFlowForgeDatasetArtifact: vi.fn(),
  listFlowForgeDataDestinations: vi.fn(),
  listFlowForgeDataMovementAudit: vi.fn(),
  listFlowForgeDataSources: vi.fn(),
  listFlowForgeDatasetArtifacts: vi.fn(),
  testFlowForgeDataDestination: vi.fn(),
  testFlowForgeDataSource: vi.fn(),
  updateFlowForgeDataDestination: vi.fn(),
  updateFlowForgeDataSource: vi.fn(),
  upsertFlowForgeDataDestination: vi.fn(),
  upsertFlowForgeDataSource: vi.fn(),
}));

function renderWithClient(ui: ReactElement, initialEntries: string[] = ["/"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("FlowForge admin pages", () => {
  beforeEach(() => {
    vi.mocked(listFlowForgeIntegrations).mockResolvedValue([
      {
        id: 10,
        workspace_id: "ws-1",
        provider: "jotform",
        integration_key: "jotform-intake",
        display_name: "Jotform Intake",
        enabled: true,
        mode: "test",
        webhook_public_id: "ffj_123",
        webhook_path: "/api/v1/flowforge/webhooks/jotform/ffj_123",
        webhook_url: "/api/v1/flowforge/webhooks/jotform/ffj_123",
        field_mapping: {},
        source_events: [
          { event_key: "intake_submitted", display_name: "Intake Submitted", description: "New intake form submission." },
        ],
        source_fields: [
          { path: "serviceRequested", label: "Requested Service", type: "text", required: true, sensitive: false },
          { path: "summary", label: "Clinical Summary", type: "text", required: false, sensitive: true },
        ],
        test_recipient_overrides: [],
        settings: {},
      },
    ]);
    vi.mocked(createJotformIntegration).mockResolvedValue({
      id: 11,
      workspace_id: "ws-1",
      provider: "jotform",
      integration_key: "new-intake",
      display_name: "New Intake",
      enabled: true,
      mode: "test",
      webhook_public_id: "ffj_456",
      webhook_path: "/api/v1/flowforge/webhooks/jotform/ffj_456",
      webhook_url: "/api/v1/flowforge/webhooks/jotform/ffj_456",
      webhook_secret: "ffjot_secret",
      field_mapping: {},
      source_events: [],
      source_fields: [],
      test_recipient_overrides: [],
      settings: {},
    });
    vi.mocked(listIntegrationTriggers).mockResolvedValue([
      {
        id: 20,
        workspace_id: "ws-1",
        integration_config_id: 10,
        trigger_key: "start-intake",
        display_name: "Start intake workflow",
        enabled: true,
        priority: 100,
        trigger_mode: "always",
        trigger_policy: "all_matching",
        version_strategy: "latest_published",
        workflow_definition_id: 1,
        workflow_version_id: null,
        condition: {},
        field_mapping: {},
        no_match_config: {},
      },
    ]);
    vi.mocked(listFlowForgeResourceSets).mockResolvedValue([
      {
        id: 30,
        workspace_id: "ws-1",
        resource_set_key: "resource-pool",
        display_name: "Resource Pool",
        source_type: "manual_csv",
        enabled: true,
        active_snapshot_batch_id: 40,
        settings: {},
      },
    ]);
    vi.mocked(createFlowForgeResourceSet).mockResolvedValue({
      id: 31,
      workspace_id: "ws-1",
      resource_set_key: "new-resource-pool",
      display_name: "New Resource Pool",
      source_type: "manual_csv",
      enabled: true,
      settings: {},
    });
    vi.mocked(listFlowForgeResourceRecords).mockResolvedValue({
      resource_set_id: 30,
      limit: 100,
      offset: 0,
      records: [
        {
          id: 300,
          source_record_key: "resource-1",
          display_name: "Jane Resource",
          primary_email: "jane@example.com",
          effective_status: "active",
          availability_status: "available",
          capacity_available: 2,
          validation_status: "valid",
          validation_errors: [],
          attributes: {},
          normalized_profile: {},
        },
      ],
    });
    vi.mocked(createManualResourceSnapshot).mockResolvedValue({
      snapshot_batch_id: 41,
      record_count: 1,
      valid_count: 1,
      invalid_count: 0,
      activated: true,
    });
    vi.mocked(updateFlowForgeResourceRecord).mockResolvedValue({
      id: 300,
      source_record_key: "resource-1",
      display_name: "Jane Updated",
      primary_email: "jane@example.com",
      effective_status: "active",
      availability_status: "available",
      capacity_available: 1,
      validation_status: "valid",
      validation_errors: [],
      attributes: {},
      normalized_profile: { insurance_carriers: "Aetna, Cigna" },
    });
    vi.mocked(deleteFlowForgeResourceRecord).mockResolvedValue({
      deleted: true,
      resource_set_id: 30,
      resource_record_id: 300,
    });
    vi.mocked(updateFlowForgeResourceSet).mockResolvedValue({
      id: 30,
      workspace_id: "ws-1",
      resource_set_key: "resource-pool",
      display_name: "Resource Pool",
      source_type: "manual_csv",
      enabled: false,
      active_snapshot_batch_id: 40,
      settings: {},
    });
    vi.mocked(deleteFlowForgeResourceSet).mockResolvedValue({
      deleted: true,
      resource_set_id: 30,
    });
    vi.mocked(listFlowForgeMatchingPolicies).mockResolvedValue([
      {
        id: 50,
        workspace_id: "ws-1",
        policy_key: "intake-routing-policy",
        display_name: "Intake Routing Policy",
        resource_set_id: 30,
        status: "draft",
      },
    ]);
    vi.mocked(listFlowForgeMatchingPolicyVersions).mockResolvedValue([
      {
        id: 51,
        workspace_id: "ws-1",
        matching_policy_id: 50,
        resource_set_id: 30,
        version_number: 1,
        version_status: "draft",
        policy: {},
        validation_status: "valid",
        validation_result: {},
      },
    ]);
    vi.mocked(createFlowForgeMatchingPolicy).mockResolvedValue({
      id: 52,
      workspace_id: "ws-1",
      policy_key: "new-policy",
      display_name: "New Policy",
      resource_set_id: 30,
      status: "draft",
    });
    vi.mocked(deleteFlowForgeMatchingPolicyVersion).mockResolvedValue({
      deleted: true,
      matching_policy_id: 50,
      matching_policy_version_id: 51,
    });
    vi.mocked(deleteFlowForgeMatchingPolicy).mockResolvedValue({
      deleted: true,
      matching_policy_id: 50,
      deleted_versions: 1,
    });
    vi.mocked(createFlowForgeMatchingPolicyLLMDraft).mockResolvedValue({
      id: 60,
      workspace_id: "ws-1",
      matching_policy_id: 50,
      resource_set_id: 30,
      prompt: "Prefer available capacity",
      generated_policy: {
        version: 1,
        eligibility: [{ field: "effective_status", operator: "equals", value: "active" }],
        scoring: [{ field: "capacity_available", operator: "gt", value: 0, weight: 5 }],
      },
      plain_language_summary: "Drafted a policy that requires active resources and prefers open capacity.",
      validation_status: "valid",
      validation_result: { valid: true, errors: [], warnings: [] },
      model_provider: "heuristic",
      model_name: "flowforge-local-draft-generator",
      status: "drafted",
    });
    vi.mocked(simulateFlowForgeMatchingPolicy).mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
      eligible_candidates: [],
      excluded_candidates: [],
      ranked_candidates: [{ source_record_key: "resource-1" }],
      selected_candidate: { source_record_key: "resource-1" },
    });
    vi.mocked(getFlowForgeSettings).mockResolvedValue({
      workspace_id: "ws-1",
      enabled: true,
      allow_designer_publish: false,
      raw_payload_retention_days: 30,
      raw_payload_retention_max_days: 90,
      default_offer_timeout_minutes: 1440,
      default_no_match_recipients: ["ops@example.com"],
      default_test_recipients: ["test@example.com"],
      settings: {},
    });
    vi.mocked(updateFlowForgeSettings).mockResolvedValue({
      workspace_id: "ws-1",
      enabled: true,
      allow_designer_publish: false,
      raw_payload_retention_days: 45,
      raw_payload_retention_max_days: 90,
      default_offer_timeout_minutes: 120,
      default_no_match_recipients: ["ops@example.com"],
      default_test_recipients: ["test@example.com"],
      settings: {},
    });
    vi.mocked(listFlowForgeDataSources).mockResolvedValue([
      {
        id: 1,
        workspace_id: "ws-1",
        source_key: "local-import",
        display_name: "Local Import",
        source_type: "local_file_test",
        enabled: true,
        mode: "test",
        config: { base_dir: "/tmp/flowforge-imports" },
      },
    ]);
    vi.mocked(upsertFlowForgeDataSource).mockResolvedValue({
      id: 1,
      workspace_id: "ws-1",
      source_key: "local-import",
      display_name: "Local Import",
      source_type: "local_file_test",
      enabled: true,
      mode: "test",
      config: { base_dir: "/tmp/flowforge-imports" },
    });
    vi.mocked(updateFlowForgeDataSource).mockResolvedValue({
      id: 1,
      workspace_id: "ws-1",
      source_key: "local-import",
      display_name: "Local Import",
      source_type: "local_file_test",
      enabled: false,
      mode: "test",
      config: { base_dir: "/tmp/flowforge-imports" },
    });
    vi.mocked(testFlowForgeDataSource).mockResolvedValue({
      ok: true,
      key: "local-import",
      kind: "source",
      type: "local_file_test",
      mode: "test",
      enabled: true,
      message: "Source 'local-import' is enabled and has testable configuration.",
    });
    vi.mocked(listFlowForgeDataDestinations).mockResolvedValue([
      {
        id: 2,
        workspace_id: "ws-1",
        destination_key: "local-export",
        display_name: "Local Export",
        destination_type: "local_file_test",
        enabled: true,
        mode: "test",
        config: { base_dir: "/tmp/flowforge-exports" },
      },
    ]);
    vi.mocked(upsertFlowForgeDataDestination).mockResolvedValue({
      id: 2,
      workspace_id: "ws-1",
      destination_key: "local-export",
      display_name: "Local Export",
      destination_type: "local_file_test",
      enabled: true,
      mode: "test",
      config: { base_dir: "/tmp/flowforge-exports" },
    });
    vi.mocked(updateFlowForgeDataDestination).mockResolvedValue({
      id: 2,
      workspace_id: "ws-1",
      destination_key: "local-export",
      display_name: "Local Export",
      destination_type: "local_file_test",
      enabled: false,
      mode: "test",
      config: { base_dir: "/tmp/flowforge-exports" },
    });
    vi.mocked(testFlowForgeDataDestination).mockResolvedValue({
      ok: true,
      key: "local-export",
      kind: "destination",
      type: "local_file_test",
      mode: "test",
      enabled: true,
      message: "Destination 'local-export' is enabled and has testable configuration.",
    });
    vi.mocked(listFlowForgeDatasetArtifacts).mockResolvedValue({
      run_id: null,
      limit: 100,
      offset: 0,
      artifacts: [
        {
          id: 701,
          workspace_id: "ws-1",
          run_id: 90,
          node_id: "import",
          artifact_key: "run:90:node:import",
          artifact_type: "import",
          storage_kind: "preview_metadata",
          storage_ref: { rows: [{ display_name: "Missing Key" }] },
          schema: { validation: { invalid_row_count: 1, invalid_rows: [{ row_number: 1, error: "Missing source_record_key" }] } },
          row_count: 1,
          byte_count: 22,
          checksum: "def",
          status: "validation_failed",
          created_at: "2026-05-05T10:04:00Z",
        },
      ],
    });
    vi.mocked(getFlowForgeDatasetArtifact).mockResolvedValue({
      id: 701,
      workspace_id: "ws-1",
      run_id: 90,
      node_id: "import",
      artifact_key: "run:90:node:import",
      artifact_type: "import",
      storage_kind: "preview_metadata",
      storage_ref: { rows: [{ display_name: "Missing Key" }] },
      schema: { validation: { invalid_row_count: 1, invalid_rows: [{ row_number: 1, error: "Missing source_record_key" }] } },
      row_count: 1,
      byte_count: 22,
      checksum: "def",
      status: "validation_failed",
      created_at: "2026-05-05T10:04:00Z",
    });
    vi.mocked(listFlowForgeDataMovementAudit).mockResolvedValue({
      run_id: null,
      limit: 100,
      offset: 0,
      audit: [
        {
          id: 901,
          workspace_id: "ws-1",
          run_id: 90,
          node_id: "import",
          action_type: "import",
          status: "failed",
          source_key: "local-import",
          destination_key: null,
          dataset_artifact_id: 701,
          resource_set_id: 20,
          actor_type: "system",
          actor_id: "flowforge",
          request: { filename: "resources.csv" },
          result: { artifact_id: 701 },
          error_message: "Import contains invalid rows.",
        },
      ],
    });
    vi.mocked(listFlowForgeCommunicationTemplates).mockResolvedValue([
      {
        id: 80,
        workspace_id: "ws-1",
        template_key: "therapist-task",
        display_name: "Therapist Task",
        description: "Human task communication",
        channel: "email",
        purpose: "human_task",
        resource_set_id: 30,
        subject: "Action requested for {{resource.display_name}}",
        body_blocks: [
          { type: "heading", content: "Review {{resource.display_name}}" },
          { type: "text", content: "Please respond before {{task.due_at}}." },
          { type: "action_buttons", actions: ["accept", "decline", "open_task"] },
        ],
        status: "draft",
        validation_status: "valid",
        validation_result: { valid: true, errors: [], warnings: [] },
        metadata: {},
      },
    ]);
    vi.mocked(createFlowForgeCommunicationTemplate).mockResolvedValue({
      id: 81,
      workspace_id: "ws-1",
      template_key: "new-template",
      display_name: "New Template",
      description: null,
      channel: "email",
      purpose: "notification",
      resource_set_id: 30,
      subject: "FlowForge update",
      body_blocks: [{ type: "text", content: "Hello {{resource.display_name}}" }],
      status: "draft",
      validation_status: "valid",
      validation_result: { valid: true, errors: [], warnings: [] },
      metadata: {},
    });
    vi.mocked(updateFlowForgeCommunicationTemplate).mockResolvedValue({
      id: 80,
      workspace_id: "ws-1",
      template_key: "therapist-task",
      display_name: "Therapist Task",
      description: "Human task communication",
      channel: "email",
      purpose: "human_task",
      resource_set_id: 30,
      subject: "Action requested for {{resource.display_name}}",
      body_blocks: [
        { type: "heading", content: "Review {{resource.display_name}}" },
        { type: "text", content: "Please respond before {{task.due_at}}." },
        { type: "action_buttons", actions: ["accept", "decline", "open_task"] },
      ],
      status: "draft",
      validation_status: "valid",
      validation_result: { valid: true, errors: [], warnings: [] },
      metadata: {},
    });
    vi.mocked(validateFlowForgeCommunicationTemplate).mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
      referenced_fields: ["resource.display_name", "task.due_at"],
      referenced_actions: ["accept", "decline", "open_task"],
      preview: { subject: "Action requested for Jane Resource", html: "<p>Preview</p>" },
    });
    vi.mocked(activateFlowForgeCommunicationTemplate).mockResolvedValue({
      id: 80,
      workspace_id: "ws-1",
      template_key: "therapist-task",
      display_name: "Therapist Task",
      description: "Human task communication",
      channel: "email",
      purpose: "human_task",
      resource_set_id: 30,
      subject: "Action requested for {{resource.display_name}}",
      body_blocks: [
        { type: "heading", content: "Review {{resource.display_name}}" },
        { type: "text", content: "Please respond before {{task.due_at}}." },
        { type: "action_buttons", actions: ["accept", "decline", "open_task"] },
      ],
      status: "active",
      validation_status: "valid",
      validation_result: { valid: true, errors: [], warnings: [] },
      metadata: {},
      activated_at: "2026-05-06T18:00:00Z",
    });
    vi.mocked(createFlowForgeCommunicationTemplateAIDraft).mockResolvedValue({
      id: 90,
      workspace_id: "ws-1",
      purpose: "human_task",
      channel: "email",
      resource_set_id: 30,
      prompt: "Write a concise task message.",
      tone: "clear and professional",
      required_actions: ["accept", "decline"],
      subject: "Generated subject for {{resource.display_name}}",
      body_blocks: [
        { type: "heading", content: "Generated heading" },
        { type: "text", content: "Generated body for {{resource.display_name}}" },
        { type: "action_buttons", actions: ["accept", "decline"] },
      ],
      plain_language_summary: "Generated a concise task message.",
      validation_status: "valid",
      validation_result: { valid: true, errors: [], warnings: [] },
      model_provider: "openai",
      model_name: "gpt-flowforge",
      status: "drafted",
      draft_source: "llm",
    });
  });

  it("creates a Jotform integration and displays the one-time secret", async () => {
    renderWithClient(<FlowForgeIntegrationsPage />);

    expect(await screen.findByRole("heading", { name: "Integrations" })).toBeInTheDocument();
    expect(await screen.findByText("Jotform Intake")).toBeInTheDocument();
    expect(await screen.findByText("1 events - 2 source fields")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open Jotform Intake" }));
    expect(await screen.findByRole("dialog", { name: "Jotform Intake" })).toBeInTheDocument();
    expect(await screen.findByText("Start intake workflow")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close integration drawer" }));

    await userEvent.click(screen.getByRole("button", { name: "Add new integration" }));
    expect(await screen.findByRole("dialog", { name: "Add integration" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add source event" }));
    await userEvent.type(screen.getByLabelText("Source Event Key 2"), "intake_updated");
    await userEvent.type(screen.getByLabelText("Source Event Display Name 2"), "Intake Updated");
    await userEvent.click(screen.getByRole("button", { name: "Add source field" }));
    await userEvent.type(screen.getByLabelText("Source Field Path 5"), "preferredLocation");
    await userEvent.type(screen.getByLabelText("Source Field Label 5"), "Preferred Location");
    await userEvent.click(screen.getByRole("button", { name: "Create Integration" }));

    expect(await screen.findByText(/ffjot_secret/)).toBeInTheDocument();
    expect(createJotformIntegration).toHaveBeenCalledWith(
      expect.objectContaining({
        integration_key: "jotform-intake",
        mode: "test",
        source_events: expect.arrayContaining([
          expect.objectContaining({ event_key: "intake_submitted", display_name: "Intake Submitted" }),
          expect.objectContaining({ event_key: "intake_updated", display_name: "Intake Updated" }),
        ]),
        source_fields: expect.arrayContaining([
          expect.objectContaining({ path: "serviceRequested", label: "Requested Service", required: true }),
          expect.objectContaining({ path: "preferredLocation", label: "Preferred Location" }),
        ]),
      }),
    );
  });

  it("creates a resource set and activates records", async () => {
    renderWithClient(<FlowForgeResourcesPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Resource Sets" })).toBeInTheDocument();
    expect(screen.getByLabelText("Resource set studio")).toHaveClass("is-saved-open");
    expect(screen.getByText("Select or Create a Resource Set")).toBeInTheDocument();
    expect(screen.getByText("How resource sets work")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Saved Resource Sets" }));
    expect(screen.getByLabelText("Resource set studio")).toHaveClass("is-saved-collapsed");
    expect(screen.getByLabelText("Saved resource sets")).toHaveAttribute("aria-hidden", "true");
    await userEvent.click(screen.getByRole("button", { name: "Saved Resource Sets" }));
    await userEvent.click(await screen.findByRole("button", { name: "Resource set options" }));
    await userEvent.click(await screen.findByRole("button", { name: "Disable resource set" }));
    await userEvent.click(await screen.findByRole("button", { name: "Resource set options" }));
    await userEvent.click(await screen.findByRole("button", { name: "Delete resource set" }));
    await userEvent.click(screen.getByRole("button", { name: "Create New Resource Set" }));
    expect(screen.getByText("New resource set draft")).toBeInTheDocument();
    expect(screen.getByText("Name the resource pool that operators and policies will use.")).toBeInTheDocument();
    expect(screen.getByLabelText("Display Name")).toHaveValue("");
    expect((screen.getByLabelText("Resource Key") as HTMLInputElement).value).toMatch(/^resource-pool-[a-z0-9]+$/);
    expect(screen.getByRole("button", { name: "Create Resource Set" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Display Name"), "New Resource Pool");
    expect((screen.getByLabelText("Resource Key") as HTMLInputElement).value).toMatch(/^new-resource-pool-[a-z0-9]+$/);
    await userEvent.click(screen.getByRole("button", { name: "Create Resource Set" }));
    await userEvent.click(screen.getByRole("button", { name: "Open Resource Pool" }));
    expect(await screen.findByText("Jane Resource")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit Jane Resource" }));
    expect(await screen.findByRole("dialog", { name: "Edit Jane Resource" })).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Record Display Name"));
    await userEvent.type(screen.getByLabelText("Record Display Name"), "Jane Updated");
    await userEvent.click(screen.getByRole("button", { name: "Add Normalized Profile field" }));
    await userEvent.type(screen.getByLabelText("Normalized Profile Key 1"), "insurance_carriers");
    await userEvent.type(screen.getByLabelText("Normalized Profile Value 1"), "Aetna, Cigna");
    await userEvent.click(screen.getByRole("button", { name: "Save Record" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Jane Resource" }));
    expect(screen.getByLabelText("Review Records to Activate")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Activate Records" })).toBeDisabled();
    await userEvent.upload(
      screen.getByLabelText("Upload CSV or JSON"),
      new File(["display_name,primary_email,capacity_total\nUploaded Resource,upload@example.com,7"], "resources.csv", { type: "text/csv" }),
    );
    expect(await screen.findByText("Loaded 1 record from resources.csv.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Activate Records" }));

    await waitFor(() => {
      expect(createFlowForgeResourceSet).toHaveBeenCalled();
      expect(updateFlowForgeResourceSet).toHaveBeenCalledWith(30, { enabled: false });
      expect(deleteFlowForgeResourceSet).toHaveBeenCalledWith(30);
      expect(updateFlowForgeResourceRecord).toHaveBeenCalledWith(
        30,
        300,
        expect.objectContaining({ display_name: "Jane Updated", normalized_profile: { insurance_carriers: "Aetna, Cigna" } }),
      );
      expect(deleteFlowForgeResourceRecord).toHaveBeenCalledWith(30, 300);
      expect(createManualResourceSnapshot).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          activate: true,
          records: [expect.objectContaining({ display_name: "Uploaded Resource", capacity_total: 7 })],
        }),
      );
    });
  });

  it("configures data movement sources, destinations, artifacts, validation failures, and audit", async () => {
    renderWithClient(<FlowForgeDataMovementPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Data Movement" })).toBeInTheDocument();
    expect(await screen.findByText("Local Import")).toBeInTheDocument();
    expect(await screen.findByText("Local Export")).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "Test" })[0]);
    expect(await screen.findByText(/Source 'local-import'/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Disable" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Save Source" }));
    await userEvent.click(screen.getByRole("button", { name: "Save Destination" }));
    await userEvent.click(await screen.findByRole("button", { name: /run:90:node:import/i }));

    expect(await screen.findByText("Validation Failures")).toBeInTheDocument();
    expect(screen.getAllByText(/Missing source_record_key/).length).toBeGreaterThan(0);
    expect(screen.getByText("Data Movement Audit")).toBeInTheDocument();
    expect(screen.getByText("Import contains invalid rows.")).toBeInTheDocument();
    await waitFor(() => {
      expect(testFlowForgeDataSource).toHaveBeenCalledWith("local-import");
      expect(updateFlowForgeDataSource).toHaveBeenCalledWith("local-import", { enabled: false });
      expect(upsertFlowForgeDataSource).toHaveBeenCalledWith(expect.objectContaining({ source_key: "local-import" }));
      expect(upsertFlowForgeDataDestination).toHaveBeenCalledWith(expect.objectContaining({ destination_key: "local-export" }));
    });
  });

  it("simulates and saves a matching policy", async () => {
    renderWithClient(<FlowForgeMatchingPoliciesPage />);

    expect(await screen.findByRole("heading", { name: "Matching Policies" })).toBeInTheDocument();
    expect(screen.getByText("How matching policies work")).toBeInTheDocument();
    expect(screen.getByText("Select or Create a Policy")).toBeInTheDocument();
    expect(await screen.findByText("Intake Routing Policy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saved Policies" })).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(screen.getByRole("button", { name: "Saved Policies" }));
    expect(screen.getByLabelText("Matching policy studio")).toHaveClass("is-saved-collapsed");
    expect(screen.getByLabelText("Saved matching policies")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Saved Policies" })).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(screen.getByRole("button", { name: "Saved Policies" }));
    expect(screen.getByLabelText("Matching policy studio")).toHaveClass("is-saved-open");
    expect(screen.getByLabelText("Saved matching policies")).toHaveAttribute("aria-hidden", "false");
    expect(screen.queryByText("Choose a resource pool to load available eligibility fields.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Intake Routing Policy/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Version options" }));
    await userEvent.click(await screen.findByRole("button", { name: "Delete version" }));
    await userEvent.selectOptions(screen.getByLabelText("Resource Pool to Evaluate"), "30");
    expect(await screen.findByText("Who is eligible?")).toBeInTheDocument();
    expect(screen.getByLabelText("Eligibility Field")).toHaveValue("effective_status");
    expect(screen.getByLabelText("Eligibility Operator")).toHaveValue("equals");
    expect(screen.getByLabelText("Eligibility Value")).toHaveValue("active");
    expect(screen.getByText("How should resources be ranked?")).toBeInTheDocument();
    expect(screen.getByLabelText("Scoring Field")).toHaveValue("capacity_available");
    expect(screen.getByLabelText("Scoring Operator")).toHaveValue("gt");
    expect(screen.getByLabelText("Scoring Value")).toHaveValue("0");
    expect(screen.getByLabelText("Fairness Window")).toHaveValue(0);
    await userEvent.type(
      screen.getByLabelText("Goal"),
      "Match active resources with available capacity and prefer Spanish-speaking providers.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Drafted a policy that requires active resources and prefers open capacity.")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Fairness Window"));
    await userEvent.type(screen.getByLabelText("Fairness Window"), "8");
    await userEvent.click(screen.getByRole("button", { name: "Add Eligibility Rule" }));
    await userEvent.selectOptions(screen.getAllByLabelText("Eligibility Field")[1], "capacity_available");
    await userEvent.selectOptions(screen.getAllByLabelText("Eligibility Operator")[1], "gt");
    await userEvent.clear(screen.getAllByLabelText("Eligibility Value")[1]);
    await userEvent.type(screen.getAllByLabelText("Eligibility Value")[1], "0");
    await userEvent.click(screen.getByRole("button", { name: "Add Scoring Rule" }));
    await userEvent.selectOptions(screen.getAllByLabelText("Scoring Field")[1], "effective_status");
    await userEvent.selectOptions(screen.getAllByLabelText("Scoring Operator")[1], "equals");
    await userEvent.clear(screen.getAllByLabelText("Scoring Value")[1]);
    await userEvent.type(screen.getAllByLabelText("Scoring Value")[1], "active");
    await userEvent.clear(screen.getAllByLabelText("Score Weight")[1]);
    await userEvent.type(screen.getAllByLabelText("Score Weight")[1], "3");
    await userEvent.click(screen.getByRole("button", { name: "Simulate Policy" }));
    expect(await screen.findByRole("heading", { name: "Simulation Result" })).toBeInTheDocument();
    expect(screen.getByText("resource-1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save Policy" }));

    await waitFor(() => {
      expect(simulateFlowForgeMatchingPolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          resources: [expect.objectContaining({ source_record_key: "resource-1", capacity_available: 2 })],
        }),
      );
      expect(createFlowForgeMatchingPolicyLLMDraft).toHaveBeenCalledWith(
        50,
        expect.objectContaining({
          prompt: "Match active resources with available capacity and prefer Spanish-speaking providers.",
          resource_set_id: 30,
          use_llm: true,
        }),
      );
      expect(deleteFlowForgeMatchingPolicyVersion).toHaveBeenCalledWith(50, 51);
      expect(createFlowForgeMatchingPolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          resource_set_id: 30,
          policy: expect.objectContaining({
            eligibility: expect.arrayContaining([
              expect.objectContaining({ field: "effective_status", operator: "equals", value: "active" }),
              expect.objectContaining({ field: "capacity_available", operator: "gt", value: 0 }),
            ]),
            scoring: expect.arrayContaining([
              expect.objectContaining({ field: "capacity_available", operator: "gt", value: 0, weight: 5 }),
              expect.objectContaining({ field: "effective_status", operator: "equals", value: "active", weight: 3 }),
            ]),
            selection: expect.objectContaining({
              strategy: "balanced_top_ranked",
              fairness: expect.objectContaining({
                within_score_delta: 8,
                penalize_active_offers: true,
                prefer_least_recently_offered: true,
              }),
            }),
          }),
        }),
      );
    });
  });

  it("hydrates matching policy builder from alternate LLM policy shape", async () => {
    vi.mocked(createFlowForgeMatchingPolicyLLMDraft).mockResolvedValueOnce({
      id: 61,
      workspace_id: "ws-1",
      matching_policy_id: 50,
      resource_set_id: 30,
      prompt: "Match therapists by insurance and specialty.",
      generated_policy: {
        version: 1,
        resource_set_id: 30,
        eligibility: {
          all: [
            { field: "status", op: "eq", value: "active" },
            { field: "accepts_new_patients", op: "eq", value: true },
            { field: "insurance_carriers", op: "contains_any", value_from: "inputs.patient_insurance_carriers" },
            { field: "specialties", op: "contains_any", value_from: "inputs.requested_specialties" },
          ],
        },
        scoring: {
          type: "points",
          rules: [
            {
              name: "Specialty match count",
              when: { field: "specialties", op: "contains_any", value_from: "inputs.requested_specialties" },
              points: 50,
            },
          ],
        },
      },
      plain_language_summary: "Only consider active therapists who accept new patients and match insurance and specialty.",
      validation_status: "valid",
      validation_result: { errors: [], warnings: [] },
      model_provider: "openai",
      model_name: "gpt-flowforge",
      status: "drafted",
    });

    renderWithClient(<FlowForgeMatchingPoliciesPage />);

    expect(await screen.findByRole("heading", { name: "Matching Policies" })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: /Intake Routing Policy/ }));
    await userEvent.type(screen.getByLabelText("Goal"), "Match therapists by insurance and specialty.");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText("Only consider active therapists who accept new patients and match insurance and specialty."),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText("Eligibility Field")[0]).toHaveValue("status");
    expect(screen.getAllByLabelText("Eligibility Operator")[0]).toHaveValue("equals");
    expect(screen.getAllByLabelText("Eligibility Value")[0]).toHaveValue("active");
    expect(screen.getAllByLabelText("Eligibility Field")[2]).toHaveValue("insurance_carriers");
    expect(screen.getAllByLabelText("Eligibility Operator")[2]).toHaveValue("contains_context");
    expect(screen.getAllByLabelText("Eligibility Value")[2]).toHaveValue("inputs.patient_insurance_carriers");
    expect(screen.getAllByLabelText("Scoring Field")[0]).toHaveValue("specialties");
    expect(screen.getAllByLabelText("Scoring Operator")[0]).toHaveValue("contains_context");
    expect(screen.getAllByLabelText("Scoring Value")[0]).toHaveValue("inputs.requested_specialties");
    expect(screen.getAllByLabelText("Score Weight")[0]).toHaveValue(50);
  });

  it("starts a new matching policy from a blank draft state", async () => {
    renderWithClient(<FlowForgeMatchingPoliciesPage />);

    expect(await screen.findByRole("heading", { name: "Matching Policies" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create New Policy" }));

    expect(screen.getByText("New policy draft")).toBeInTheDocument();
    expect((screen.getByLabelText("Policy Key") as HTMLInputElement).value).toMatch(/^new-matching-policy-[a-z0-9]+$/);
    expect(screen.getByLabelText("Display Name")).toHaveValue("New Matching Policy");
    expect(screen.getByText("Choose a resource pool to load available eligibility fields.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Eligibility Field")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Policy" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Simulate Policy" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Goal"), "Prefer resources with open capacity.");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByText(
        "I can draft that policy, but I need to know which resource pool to use first. Choose one below and I will continue with your prompt.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Run next action: Resource Pool" }));

    expect(await screen.findByText("Drafted a policy that requires active resources and prefers open capacity.")).toBeInTheDocument();
    await waitFor(() => {
      expect(createFlowForgeMatchingPolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          policy_key: expect.stringMatching(/^new-matching-policy-[a-z0-9]+$/),
          display_name: "New Matching Policy",
          resource_set_id: 30,
        }),
      );
      expect(createFlowForgeMatchingPolicyLLMDraft).toHaveBeenCalledWith(
        52,
        expect.objectContaining({
          prompt: "Prefer resources with open capacity.",
          resource_set_id: 30,
          use_llm: true,
        }),
      );
    });
  });

  it("deletes an existing matching policy from the policy card menu", async () => {
    renderWithClient(<FlowForgeMatchingPoliciesPage />);

    expect(await screen.findByText("Intake Routing Policy")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Policy options" }));
    await userEvent.click(await screen.findByRole("button", { name: "Delete policy" }));

    await waitFor(() => {
      expect(deleteFlowForgeMatchingPolicy).toHaveBeenCalledWith(50);
    });
  });

  it("edits, previews, validates, and activates communication templates", async () => {
    renderWithClient(<FlowForgeCommunicationTemplatesPage />);

    expect(await screen.findByRole("heading", { name: "Communication Templates" })).toBeInTheDocument();
    expect(await screen.findByText("Therapist Task")).toBeInTheDocument();
    expect((await screen.findAllByText("Action requested for Jane Resource")).length).toBeGreaterThan(0);
    expect(screen.getByText("resource.display_name")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Text" }));
    await userEvent.click(screen.getByRole("button", { name: "resource.display_name" }));
    await userEvent.click(screen.getByRole("button", { name: "FlowForge AI" }));
    await userEvent.type(screen.getByLabelText("Prompt"), "Write a concise task message.");
    await userEvent.click(screen.getByLabelText("Accept"));
    await userEvent.click(screen.getByLabelText("Decline"));
    await userEvent.click(screen.getByRole("button", { name: "Generate Draft" }));
    expect(await screen.findByText("Generated a concise task message.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Apply Draft" }));
    expect(screen.getByLabelText("Subject")).toHaveValue("Generated subject for {{resource.display_name}}");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(screen.getByRole("button", { name: "Validate" }));
    expect(await screen.findByText("Valid template")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Activate" }));

    await waitFor(() => {
      expect(updateFlowForgeCommunicationTemplate).toHaveBeenCalledWith(
        80,
        expect.objectContaining({
          display_name: "Therapist Task",
          resource_set_id: 30,
          subject: "Generated subject for {{resource.display_name}}",
          body_blocks: expect.arrayContaining([expect.objectContaining({ type: "text" })]),
        }),
      );
      expect(createFlowForgeCommunicationTemplateAIDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "Write a concise task message.",
          purpose: "human_task",
          resource_set_id: 30,
          required_actions: ["open_task", "accept", "decline"],
          use_llm: true,
        }),
      );
      expect(validateFlowForgeCommunicationTemplate).toHaveBeenCalledWith(
        80,
        expect.objectContaining({ preview_context: expect.objectContaining({ resource: expect.any(Object) }) }),
      );
      expect(activateFlowForgeCommunicationTemplate).toHaveBeenCalledWith(80);
    });
  });

  it("opens a prefilled new communication template draft from designer context", async () => {
    renderWithClient(<FlowForgeCommunicationTemplatesPage />, [
      "/automation/flowforge/admin/communication-templates?purpose=human_task&channel=email&resource_set_id=30&return_to=%2Fautomation%2Fflowforge",
    ]);

    expect(await screen.findByRole("heading", { name: "Communication Templates" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Designer" })).toHaveAttribute(
      "href",
      "/automation/flowforge",
    );
    expect(screen.getByLabelText("Display Name")).toHaveValue("");
    expect(screen.getByLabelText("Purpose")).toHaveValue("human_task");
    await waitFor(() => {
      expect(screen.getByLabelText("Resource Pool")).toHaveValue("30");
    });
    expect(screen.getByText("Untitled communication template")).toBeInTheDocument();
  });

  it("saves FlowForge workspace settings", async () => {
    renderWithClient(<FlowForgeSettingsPage />);

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("switch", { name: "Enable FlowForge Runtime" })).toHaveAttribute("aria-checked", "true");
    });
    expect(screen.getByRole("switch", { name: "Allow Designer Publish" })).toHaveAttribute("aria-checked", "false");
    const retention = await screen.findByLabelText("Raw Payload Retention Days");
    await userEvent.clear(retention);
    await userEvent.type(retention, "45");
    await userEvent.click(screen.getByRole("button", { name: "Save Settings" }));

    await waitFor(() => {
      expect(updateFlowForgeSettings).toHaveBeenCalledWith(expect.objectContaining({ raw_payload_retention_days: 45 }));
    });
  });
});
