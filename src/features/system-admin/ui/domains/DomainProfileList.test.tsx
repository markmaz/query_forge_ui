import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DomainProfileList from "./DomainProfileList";

const mocks = vi.hoisted(() => ({
  useDomainProfileList: vi.fn(),
  useCreateDomainProfile: vi.fn(),
  useUpdateDomainProfile: vi.fn(),
  useDeleteDomainProfile: vi.fn(),
  generateDomainProfile: vi.fn(),
  generateDomainProfilesBatch: vi.fn(),
  generateAllDomainProfiles: vi.fn(),
  parseDomainProfileApiError: vi.fn(),
  reindexDomainVectors: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
}));

vi.mock("@/features/system-admin/hooks", () => ({
  useDomainProfileList: mocks.useDomainProfileList,
  useCreateDomainProfile: mocks.useCreateDomainProfile,
  useUpdateDomainProfile: mocks.useUpdateDomainProfile,
  useDeleteDomainProfile: mocks.useDeleteDomainProfile,
}));

vi.mock("@/features/system-admin/api", () => ({
  generateDomainProfile: mocks.generateDomainProfile,
  generateDomainProfilesBatch: mocks.generateDomainProfilesBatch,
  generateAllDomainProfiles: mocks.generateAllDomainProfiles,
  parseDomainProfileApiError: mocks.parseDomainProfileApiError,
  reindexDomainVectors: mocks.reindexDomainVectors,
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    warning: mocks.toastWarning,
  },
}));

vi.mock("./DomainProfileForm", () => ({
  default: ({
    profile,
    onSave,
    onCancel,
  }: {
    profile: { domain_name?: string } | null;
    onSave: (payload: Record<string, unknown>) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="domain-profile-form">
      <div>{profile ? "Edit Domain Profile" : "Create Domain Profile"}</div>
      <button
        type="button"
        onClick={() =>
          onSave({
            domain_name: profile?.domain_name ?? "New Domain",
            summary: "Profile summary",
          })
        }
      >
        Save Domain Profile
      </button>
      <button type="button" onClick={onCancel}>
        Cancel Domain Profile
      </button>
    </div>
  ),
}));

const PROFILES = [
  {
    id: 11,
    workspace_id: "ws-1",
    domain_id: 101,
    domain_name: "Sales",
    summary: "Sales summary",
    keywords: ["sales"],
    entities: [],
    metrics: [],
    attributes: [],
    synonyms: [],
    acronyms: [],
    notes: null,
    embedding_text: null,
    content_hash: null,
    embedding_model: null,
    embedded_at: null,
    created_at: "2026-03-10T10:00:00Z",
    updated_at: "2026-03-10T10:00:00Z",
  },
  {
    id: 12,
    workspace_id: "ws-1",
    domain_id: 102,
    domain_name: "Finance",
    summary: "Finance summary",
    keywords: ["finance"],
    entities: [],
    metrics: [],
    attributes: [],
    synonyms: [],
    acronyms: [],
    notes: null,
    embedding_text: null,
    content_hash: null,
    embedding_model: null,
    embedded_at: null,
    created_at: "2026-03-10T10:00:00Z",
    updated_at: "2026-03-10T10:00:00Z",
  },
];

function renderPage() {
  return render(<DomainProfileList />);
}

describe("DomainProfileList generation controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useDomainProfileList.mockReturnValue({
      data: { profiles: PROFILES, count: PROFILES.length },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    mocks.useCreateDomainProfile.mockReturnValue({
      mutate: vi.fn((_body, options) => options?.onSuccess?.()),
      isPending: false,
    });
    mocks.useUpdateDomainProfile.mockReturnValue({
      mutate: vi.fn((_payload, options) => options?.onSuccess?.()),
      isPending: false,
    });
    mocks.useDeleteDomainProfile.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    mocks.generateDomainProfile.mockResolvedValue({
      result: {
        domain_id: 101,
        status: "generated",
        trace_id: "trace-101",
        generation_time_ms: 145,
      },
    });
    mocks.generateDomainProfilesBatch.mockResolvedValue({
      total: 2,
      generated: 1,
      unchanged: 1,
      failed: 0,
      results: [
        { domain_id: 101, status: "generated", trace_id: "trace-101" },
        { domain_id: 102, status: "unchanged", trace_id: "trace-102" },
      ],
    });
    mocks.generateAllDomainProfiles.mockResolvedValue({
      total: 2,
      generated: 2,
      unchanged: 0,
      failed: 0,
      results: [
        { domain_id: 101, status: "generated", trace_id: "trace-101" },
        { domain_id: 102, status: "generated", trace_id: "trace-102" },
      ],
    });
    mocks.parseDomainProfileApiError.mockImplementation((error: unknown, fallback: string) => {
      if (error instanceof Error) return error;
      return new Error(fallback);
    });
    mocks.reindexDomainVectors.mockResolvedValue(undefined);
  });

  it("selects one domain and calls single generate endpoint", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByLabelText(/select domain sales/i));
    await user.click(screen.getByRole("button", { name: /generate selected/i }));

    await waitFor(() => {
      expect(mocks.generateDomainProfile).toHaveBeenCalledWith(101, { force: false });
    });
    expect(mocks.generateDomainProfilesBatch).not.toHaveBeenCalled();
    expect(mocks.generateAllDomainProfiles).not.toHaveBeenCalled();
  });

  it("selects multiple domains and calls batch endpoint", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByLabelText(/select domain sales/i));
    await user.click(screen.getByLabelText(/select domain finance/i));
    await user.click(screen.getByRole("button", { name: /generate selected/i }));

    await waitFor(() => {
      expect(mocks.generateDomainProfilesBatch).toHaveBeenCalledWith({
        domain_ids: [101, 102],
        force: false,
      });
    });
    expect(mocks.generateDomainProfile).not.toHaveBeenCalled();
  });

  it("calls generate-all endpoint with force/include_inactive toggles", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByLabelText(/force regenerate/i));
    await user.click(screen.getByLabelText(/include inactive/i));
    await user.click(screen.getByRole("button", { name: /generate all/i }));

    await waitFor(() => {
      expect(mocks.generateAllDomainProfiles).toHaveBeenCalledWith({
        force: true,
        include_inactive: true,
      });
    });
  });

  it("shows loading text and disables actions while generating", async () => {
    const user = userEvent.setup();
    const resolveRequestRef: { current: ((value: unknown) => void) | null } = { current: null };
    mocks.generateDomainProfile.mockReturnValue(
      new Promise<unknown>((resolve) => {
        resolveRequestRef.current = resolve as (value: unknown) => void;
      }),
    );
    renderPage();

    await user.click(screen.getByLabelText(/select domain sales/i));
    await user.click(screen.getByRole("button", { name: /generate selected/i }));

    expect(screen.getByText(/generating selected domain profile/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate selected/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /generate all/i })).toBeDisabled();

    if (resolveRequestRef.current) {
      resolveRequestRef.current({
        result: { domain_id: 101, status: "generated", trace_id: "trace-101", generation_time_ms: 25 },
      });
    }

    await waitFor(() => {
      expect(screen.queryByText(/generating selected domain profile/i)).not.toBeInTheDocument();
    });
  });

  it("shows success and error toasts for generation flows", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByLabelText(/select domain sales/i));
    await user.click(screen.getByRole("button", { name: /generate selected/i }));
    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalled();
    });

    mocks.generateDomainProfile.mockRejectedValueOnce(new Error("backend exploded"));

    await user.click(screen.getByLabelText(/select domain sales/i));
    await user.click(screen.getByRole("button", { name: /generate selected/i }));
    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("backend exploded");
    });
  });

  it("shows a custom rebuild confirmation dialog after creating a profile", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /create profile/i }));
    await user.click(screen.getByRole("button", { name: /save domain profile/i }));

    expect(screen.getByRole("dialog", { name: /rebuild domain vectors confirmation/i })).toBeInTheDocument();
    expect(screen.getByText(/was created\. re-run the domain vector index now/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /re-run index/i }));

    await waitFor(() => {
      expect(mocks.reindexDomainVectors).toHaveBeenCalledWith({});
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Domain vector reindex started");
  });

  it("shows a custom rebuild confirmation dialog after updating a profile", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Sales"));
    await user.click(screen.getByRole("button", { name: /save domain profile/i }));

    expect(screen.getByRole("dialog", { name: /rebuild domain vectors confirmation/i })).toBeInTheDocument();
    expect(screen.getByText(/was updated\. re-run the domain vector index now/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /not now/i }));

    expect(mocks.reindexDomainVectors).not.toHaveBeenCalled();
  });
});
