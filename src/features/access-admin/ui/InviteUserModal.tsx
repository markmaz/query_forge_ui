import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, FormGroup, Input, Label, Spinner } from "reactstrap";
import { useQuery } from "@tanstack/react-query";

import type { UserProfile, UserProfileUpdate } from "../../../domain-model/Users";
import { fetchDomainUsers, fetchDomains, type Domain } from "../../../shared/services/queryStudioAdminApi";
import { groupDomainRows, isWorkflowDomain, workflowDomainBadgeLabel } from "../../../shared/domain/domainPresentation";
import OrganizationWorkspaceAccess, { type WorkspaceSelection } from "./OrganizationWorkspaceAccess";
import "./InviteUserDrawer.css";

export type DomainAccessLevel = "none" | "reader" | "editor";

export type UserDomainAccessDraft = {
  desired: Record<string, DomainAccessLevel>;
  baseline: Record<string, DomainAccessLevel>;
};

type Props = {
  isOpen: boolean;
  toggle: () => void;
  mode?: "invite" | "edit";
  userProfile?: UserProfile;
  onSave: (payload: UserProfileUpdate, domainAccess: UserDomainAccessDraft) => Promise<void>;
};

type DomainProfileChoice = "custom" | "none" | "read_all" | "edit_all";

function toSaveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function buildEmptyDomainAccess(domains: Domain[]): Record<string, DomainAccessLevel> {
  const next: Record<string, DomainAccessLevel> = {};
  domains.forEach((domain) => {
    next[String(domain.id)] = "none";
  });
  return next;
}

const UserModal: React.FC<Props> = ({
  isOpen,
  toggle,
  userProfile,
  mode = "invite",
  onSave,
}) => {
  const isEditMode = mode === "edit" && Boolean(userProfile?.user_id);

  const [email, setEmail] = useState("");
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<WorkspaceSelection[]>([]);

  const [domainSearch, setDomainSearch] = useState("");
  const [domainProfileChoice, setDomainProfileChoice] = useState<DomainProfileChoice>("custom");
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [domainAccess, setDomainAccess] = useState<Record<string, DomainAccessLevel>>({});
  const [baselineDomainAccess, setBaselineDomainAccess] = useState<Record<string, DomainAccessLevel>>({});

  const [emailError, setEmailError] = useState("");
  const [orgError, setOrgError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const initDomainStateKeyRef = useRef("");

  const {
    data: domains = [],
    isLoading: domainsLoading,
    isError: domainsError,
  } = useQuery<Domain[], Error>({
    queryKey: ["domains", "user-management"],
    queryFn: async () => {
      const response = await fetchDomains();
      return response.rows
        .slice()
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    },
    enabled: isOpen,
    initialData: [],
    placeholderData: (prev) => prev ?? [],
  });

  const {
    data: loadedDomainAccess,
    isLoading: domainAccessLoading,
    isError: domainAccessError,
  } = useQuery<Record<string, DomainAccessLevel>, Error>({
    queryKey: [
      "userDomainAccess",
      userProfile?.user_id ?? null,
      domains.map((domain) => domain.id).join(","),
    ],
    enabled: isOpen && isEditMode && domains.length > 0,
    queryFn: async () => {
      const userId = String(userProfile?.user_id ?? "");
      const entries = await Promise.all(
        domains.map(async (domain) => {
          const response = await fetchDomainUsers(domain.id);
          const matched = response.rows.find((row) => String(row.user_id) === userId);
          const level: DomainAccessLevel = matched
            ? matched.can_edit
              ? "editor"
              : "reader"
            : "none";
          return [String(domain.id), level] as const;
        })
      );
      return Object.fromEntries(entries);
    },
  });

  useEffect(() => {
    if (!isOpen) {
      initDomainStateKeyRef.current = "";
      return;
    }
    setEmailError("");
    setOrgError("");
    setSaveError("");

    if (userProfile) {
      setEmail(userProfile.email ?? "");
      setSelectedWorkspaces(
        (userProfile.workspaces ?? []).map((workspace) => ({
          workspace_id: String(workspace.workspace_id),
          is_default: !!workspace.is_default,
        }))
      );
    } else {
      setEmail("");
      setSelectedWorkspaces([]);
    }
  }, [isOpen, userProfile]);

  useEffect(() => {
    if (!isOpen || domains.length === 0) return;
    if (isEditMode && domainAccessLoading) return;

    const base = buildEmptyDomainAccess(domains);
    const baseline =
      isEditMode && loadedDomainAccess
        ? { ...base, ...loadedDomainAccess }
        : base;

    const initKey = [
      mode,
      userProfile?.user_id ?? "invite",
      Object.entries(baseline)
        .map(([domainId, level]) => `${domainId}:${level}`)
        .join("|"),
    ].join("::");

    if (initDomainStateKeyRef.current === initKey) return;
    initDomainStateKeyRef.current = initKey;

    const initiallySelectedDomainIds = domains
      .filter((domain) => (baseline[String(domain.id)] ?? "none") !== "none")
      .map((domain) => String(domain.id));

    setBaselineDomainAccess(baseline);
    setDomainAccess(baseline);
    setDomainProfileChoice("custom");
    setSelectedDomainIds(initiallySelectedDomainIds);
    setDomainSearch("");
  }, [isOpen, mode, userProfile?.user_id, domains, isEditMode, domainAccessLoading, loadedDomainAccess]);

  const filteredDomains = useMemo(() => {
    const q = domainSearch.trim().toLowerCase();
    if (!q) return domains;
    return domains.filter((domain) => {
      const name = (domain.name ?? "").toLowerCase();
      const kind = (domain.kind ?? "").toLowerCase();
      const description = (domain.description ?? "").toLowerCase();
      return name.includes(q) || kind.includes(q) || description.includes(q);
    });
  }, [domains, domainSearch]);

  const domainCounts = useMemo(() => {
    const counts = { none: 0, reader: 0, editor: 0 };
    domains.forEach((domain) => {
      const level = domainAccess[String(domain.id)] ?? "none";
      counts[level] += 1;
    });
    return counts;
  }, [domains, domainAccess]);

  const filteredDomainIds = useMemo(
    () => filteredDomains.map((domain) => String(domain.id)),
    [filteredDomains]
  );
  const groupedFilteredDomains = useMemo(() => groupDomainRows(filteredDomains), [filteredDomains]);

  const allFilteredSelected =
    filteredDomainIds.length > 0 && filteredDomainIds.every((domainId) => selectedDomainIds.includes(domainId));

  const setAllDomainsTo = (level: DomainAccessLevel) => {
    setDomainAccess((prev) => {
      const next = { ...prev };
      domains.forEach((domain) => {
        next[String(domain.id)] = level;
      });
      return next;
    });
  };

  const setSelectedDomainsTo = (level: DomainAccessLevel) => {
    if (selectedDomainIds.length === 0) return;
    setDomainAccess((prev) => {
      const next = { ...prev };
      selectedDomainIds.forEach((domainId) => {
        next[domainId] = level;
      });
      return next;
    });
    setDomainProfileChoice("custom");
  };

  const setDomainLevel = (domainId: string, level: DomainAccessLevel) => {
    setDomainAccess((prev) => ({ ...prev, [domainId]: level }));
    setDomainProfileChoice("custom");
  };

  const toggleDomainSelection = (domainId: string) => {
    setSelectedDomainIds((prev) =>
      prev.includes(domainId) ? prev.filter((id) => id !== domainId) : [...prev, domainId]
    );
  };

  const toggleSelectAllFiltered = () => {
    setSelectedDomainIds((prev) => {
      if (allFilteredSelected) {
        const removeSet = new Set(filteredDomainIds);
        return prev.filter((domainId) => !removeSet.has(domainId));
      }
      const next = new Set(prev);
      filteredDomainIds.forEach((domainId) => next.add(domainId));
      return [...next];
    });
  };

  const onDomainProfileChange = (choice: DomainProfileChoice) => {
    setDomainProfileChoice(choice);
    if (choice === "none") {
      setAllDomainsTo("none");
      return;
    }
    if (choice === "read_all") {
      setAllDomainsTo("reader");
      return;
    }
    if (choice === "edit_all") {
      setAllDomainsTo("editor");
    }
  };

  const handleSubmit = async () => {
    setEmailError("");
    setOrgError("");
    setSaveError("");

    let isValid = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address.");
      isValid = false;
    }

    if (selectedWorkspaces.length === 0) {
      setOrgError("Please assign at least one workspace.");
      isValid = false;
    }

    if (!isValid) return;

    const payload: UserProfileUpdate = {
      user_id: userProfile?.user_id ?? null,
      email,
      workspaces: selectedWorkspaces,
    };

    setIsSaving(true);
    try {
      await onSave(payload, {
        desired: domainAccess,
        baseline: baselineDomainAccess,
      });
      toggle();
    } catch (error) {
      setSaveError(toSaveErrorMessage(error, "Unable to save user access."));
    } finally {
      setIsSaving(false);
    }
  };

  const headerText = mode === "edit" ? "Edit User Access" : "Invite User";

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) toggle();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, toggle, isSaving]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="offcanvas-backdrop fade show" onClick={() => !isSaving && toggle()} />
      <div
        className="offcanvas offcanvas-end show user-mgmt-offcanvas"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={headerText}
      >
        <div className="offcanvas-header border-bottom">
          <div>
            <h5 className="offcanvas-title mb-1">{headerText}</h5>
            <div className="small text-muted">
              {isEditMode
                ? "Update workspace access, domain permissions, and direct RBAC roles."
                : "Set up workspace access, domain permissions, and direct RBAC roles before sending the invite."}
            </div>
          </div>
          <button type="button" className="btn-close" onClick={toggle} aria-label="Close" disabled={isSaving} />
        </div>

        <div className="offcanvas-body user-mgmt-offcanvas-body">
          {saveError ? (
            <div className="alert alert-danger py-2 mb-3" role="alert">
              {saveError}
            </div>
          ) : null}

          <section className="user-mgmt-section">
            <div className="user-mgmt-section-header">
              <h6 className="mb-0">Identity</h6>
              <span className="small text-muted">
                {mode === "edit"
                  ? "Update the email used for login and notifications."
                  : "Choose the email address that will receive the invite."}
              </span>
            </div>
            <FormGroup className="mb-0">
              <Label htmlFor="userEmail">Email</Label>
              <Input
                type="email"
                id="userEmail"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                invalid={Boolean(emailError)}
                disabled={isSaving}
              />
              {emailError ? <small className="text-danger">{emailError}</small> : null}
            </FormGroup>
          </section>

          <section className="user-mgmt-section">
            <div className="user-mgmt-section-header">
              <h6 className="mb-0">Organization Access</h6>
              <span className="small text-muted">Choose the workspaces this user can open and mark one default workspace.</span>
            </div>
            <OrganizationWorkspaceAccess
              selected={selectedWorkspaces}
              onSelectionChange={setSelectedWorkspaces}
              disabled={isSaving}
            />
            {orgError ? <div className="text-danger mt-2">{orgError}</div> : null}
          </section>

          <section className="user-mgmt-section user-domain-access-card">
            <div className="user-mgmt-section-header">
              <h6 className="mb-0">Domain Access</h6>
              <div className="small text-muted">
                {domainCounts.editor} editor • {domainCounts.reader} reader • {domainCounts.none} none
              </div>
            </div>
            <div className="user-mgmt-section-copy">
              Domain permissions control which business domains this user can browse or edit inside Query Studio and related tools.
            </div>

            <div className="user-domain-access-toolbar mb-2">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white">
                  <i className="fa fa-search text-muted" />
                </span>
                <input
                  className="form-control"
                  value={domainSearch}
                  onChange={(event) => setDomainSearch(event.target.value)}
                  placeholder="Search domains..."
                  disabled={isSaving}
                />
              </div>

              <Input
                type="select"
                bsSize="sm"
                value={domainProfileChoice}
                onChange={(event) => onDomainProfileChange(event.target.value as DomainProfileChoice)}
                disabled={isSaving || domains.length === 0}
              >
                <option value="custom">Custom access</option>
                <option value="none">No access</option>
                <option value="read_all">Read all domains</option>
                <option value="edit_all">Edit all domains</option>
              </Input>
            </div>

            <div className="d-flex gap-2 flex-wrap mb-2">
              <Button
                color="light"
                size="sm"
                outline
                onClick={() => setSelectedDomainsTo("reader")}
                disabled={isSaving || selectedDomainIds.length === 0}
              >
                Set selected Reader
              </Button>
              <Button
                color="light"
                size="sm"
                outline
                onClick={() => setSelectedDomainsTo("editor")}
                disabled={isSaving || selectedDomainIds.length === 0}
              >
                Set selected Editor
              </Button>
              <Button
                color="light"
                size="sm"
                outline
                onClick={() => setSelectedDomainsTo("none")}
                disabled={isSaving || selectedDomainIds.length === 0}
              >
                Clear selected
              </Button>
            </div>

            {domainsLoading || (isEditMode && domainAccessLoading) ? (
              <div className="d-flex align-items-center gap-2 mt-2">
                <Spinner size="sm" /> Loading domain permissions...
              </div>
            ) : domainsError || domainAccessError ? (
              <div className="text-danger small">Failed to load domain permissions.</div>
            ) : (
              <div className="user-domain-access-table-wrap">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th style={{ width: 42 }}>
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                          aria-label="Select all filtered domains"
                          disabled={isSaving || filteredDomainIds.length === 0}
                        />
                      </th>
                      <th>Domain</th>
                      <th style={{ width: 260 }}>Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDomains.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-muted small py-3">
                          No domains match your search.
                        </td>
                      </tr>
                    ) : (
                      groupedFilteredDomains.flatMap((group) => [
                        <tr key={`group-${group.key}`} className={`user-domain-group-row ${group.className}`}>
                          <td colSpan={3}>
                            <span>{group.label}</span>
                            <span className="user-domain-group-count">{group.rows.length}</span>
                          </td>
                        </tr>,
                        ...group.rows.map((domain) => {
                        const domainId = String(domain.id);
                        const level = domainAccess[domainId] ?? "none";
                        const isSelected = selectedDomainIds.includes(domainId);
                        const workflowBadge = workflowDomainBadgeLabel(domain);
                        return (
                          <tr key={domainId} className={isWorkflowDomain(domain) ? "user-domain-row--workflow" : ""}>
                            <td>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleDomainSelection(domainId)}
                                aria-label={`Select domain ${domain.name}`}
                                disabled={isSaving}
                              />
                            </td>
                            <td>
                              <div className="user-domain-name-cell">
                                <span className="fw-semibold">{domain.name}</span>
                                {workflowBadge ? <span className="user-domain-workflow-badge">{workflowBadge}</span> : null}
                              </div>
                              <div className="small text-muted">
                                {domain.kind ?? "General"}
                                {domain.description ? ` • ${domain.description}` : ""}
                              </div>
                            </td>
                            <td>
                              <div className="btn-group btn-group-sm user-domain-role-group" role="group" aria-label="Domain access level">
                                <button
                                  type="button"
                                  className={`btn ${level === "none" ? "btn-secondary" : "btn-outline-secondary"}`}
                                  onClick={() => setDomainLevel(domainId, "none")}
                                  disabled={isSaving}
                                >
                                  None
                                </button>
                                <button
                                  type="button"
                                  className={`btn ${level === "reader" ? "btn-primary" : "btn-outline-primary"}`}
                                  onClick={() => setDomainLevel(domainId, "reader")}
                                  disabled={isSaving}
                                >
                                  Reader
                                </button>
                                <button
                                  type="button"
                                  className={`btn ${level === "editor" ? "btn-primary" : "btn-outline-primary"}`}
                                  onClick={() => setDomainLevel(domainId, "editor")}
                                  disabled={isSaving}
                                >
                                  Editor
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }),
                      ])
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>

        <div className="border-top p-3 d-flex justify-content-end gap-2">
          <Button color="secondary" onClick={toggle} disabled={isSaving}>
            Cancel
          </Button>
          <Button color="primary" onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <>
                <Spinner size="sm" className="me-2" />
                Saving...
              </>
            ) : mode === "edit" ? (
              "Save Changes"
            ) : (
              "Send Invite"
            )}
          </Button>
        </div>
      </div>
    </>,
    document.body
  );
};

export default UserModal;
