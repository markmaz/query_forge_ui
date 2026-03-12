import React, { useEffect, useMemo, useState } from "react";
import { Input, Spinner } from "reactstrap";
import { useQuery } from "@tanstack/react-query";

import StyledTable from "../../../shared/components/StyledTable";
import {
  listOrganizations,
  listWorkspaceBindings,
} from "../../system-admin/api/adminTenancyApi";
import type {
  TenancyOrganization,
  WorkspaceBindingRow,
} from "../../system-admin/types/tenancy";

export type WorkspaceSelection = {
  workspace_id: string;
  is_default: boolean;
};

type Props = {
  selected?: WorkspaceSelection[];
  onSelectionChange: (selected: WorkspaceSelection[]) => void;
  disabled?: boolean;
};

type SelectionMap = Record<string, boolean>;

const ORG_LIMIT = 500;
const WORKSPACE_LIMIT = 5000;

function mapToSelectionArray(map: SelectionMap): WorkspaceSelection[] {
  return Object.entries(map).map(([workspace_id, is_default]) => ({
    workspace_id,
    is_default: Boolean(is_default),
  }));
}

function fromSelectedProp(selected?: WorkspaceSelection[]): SelectionMap {
  if (!Array.isArray(selected)) return {};
  return selected.reduce<SelectionMap>((accumulator, item) => {
    accumulator[String(item.workspace_id)] = Boolean(item.is_default);
    return accumulator;
  }, {});
}

function buildOrganizationLookup(
  organizations: TenancyOrganization[],
  workspaceBindings: WorkspaceBindingRow[]
): TenancyOrganization[] {
  const byId = new Map<string, TenancyOrganization>();
  organizations.forEach((organization) => {
    byId.set(String(organization.organization_id), organization);
  });

  workspaceBindings.forEach((workspace) => {
    const orgId = String(workspace.organization_id ?? "").trim();
    if (!orgId || byId.has(orgId)) return;
    byId.set(orgId, {
      organization_id: orgId,
      name: workspace.organization_name || orgId,
      slug: "",
      description: null,
      is_active: true,
      created_at: null,
      updated_at: null,
    });
  });

  return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name));
}

const OrganizationWorkspaceAccess: React.FC<Props> = ({ selected, onSelectionChange, disabled = false }) => {
  const [selectedMap, setSelectedMap] = useState<SelectionMap>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedOrgIds, setExpandedOrgIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSelectedMap(fromSelectedProp(selected));
  }, [selected]);

  const organizationsQuery = useQuery({
    queryKey: ["admin", "organizations", "user-management"],
    queryFn: () =>
      listOrganizations({
        include_inactive: true,
        limit: ORG_LIMIT,
        offset: 0,
      }),
    staleTime: 30_000,
  });

  const workspaceBindingsQuery = useQuery({
    queryKey: ["admin", "workspace-bindings", "user-management"],
    queryFn: () =>
      listWorkspaceBindings({
        include_inactive: true,
        limit: WORKSPACE_LIMIT,
        offset: 0,
      }),
    staleTime: 30_000,
  });

  const workspaceBindings = workspaceBindingsQuery.data?.rows ?? [];
  const organizationRows = useMemo(
    () => buildOrganizationLookup(organizationsQuery.data?.rows ?? [], workspaceBindings),
    [organizationsQuery.data?.rows, workspaceBindings]
  );

  const workspacesByOrganization = useMemo(() => {
    const grouped = new Map<string, WorkspaceBindingRow[]>();
    workspaceBindings.forEach((workspace) => {
      const orgId = String(workspace.organization_id ?? "").trim();
      if (!orgId) return;
      const existing = grouped.get(orgId) ?? [];
      existing.push(workspace);
      grouped.set(orgId, existing);
    });

    grouped.forEach((rows) => {
      rows.sort((left, right) => left.workspace_name.localeCompare(right.workspace_name));
    });
    return grouped;
  }, [workspaceBindings]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredOrganizations = useMemo(() => {
    if (!normalizedSearch) return organizationRows;
    return organizationRows.filter((organization) => {
      const name = organization.name.toLowerCase();
      const slug = (organization.slug ?? "").toLowerCase();
      const description = (organization.description ?? "").toLowerCase();
      return (
        name.includes(normalizedSearch) ||
        slug.includes(normalizedSearch) ||
        description.includes(normalizedSearch)
      );
    });
  }, [normalizedSearch, organizationRows]);

  const toggleOrganizationExpanded = (organizationId: string) => {
    setExpandedOrgIds((previous) => ({
      ...previous,
      [organizationId]: !previous[organizationId],
    }));
  };

  const toggleWorkspace = (workspaceId: string) => {
    setSelectedMap((previous) => {
      const next = { ...previous };
      if (Object.prototype.hasOwnProperty.call(next, workspaceId)) {
        const removedWasDefault = next[workspaceId] === true;
        delete next[workspaceId];
        if (removedWasDefault) {
          const firstRemaining = Object.keys(next)[0];
          if (firstRemaining) {
            next[firstRemaining] = true;
          }
        }
      } else {
        const hasDefault = Object.values(next).some((isDefault) => isDefault);
        next[workspaceId] = !hasDefault;
      }
      onSelectionChange(mapToSelectionArray(next));
      return next;
    });
  };

  const setDefaultWorkspace = (workspaceId: string) => {
    setSelectedMap((previous) => {
      const next: SelectionMap = {};
      Object.keys(previous).forEach((id) => {
        next[id] = false;
      });
      next[workspaceId] = true;
      onSelectionChange(mapToSelectionArray(next));
      return next;
    });
  };

  const selectedWorkspaceIds = useMemo(() => new Set(Object.keys(selectedMap)), [selectedMap]);
  const selectedCount = selectedWorkspaceIds.size;

  if (organizationsQuery.isLoading || workspaceBindingsQuery.isLoading) {
    return (
      <div className="d-flex align-items-center gap-2 mt-2">
        <Spinner size="sm" /> Loading organizations...
      </div>
    );
  }

  if (organizationsQuery.isError || workspaceBindingsQuery.isError) {
    return <div className="text-danger mt-2">Unable to load organization workspace access.</div>;
  }

  return (
    <div className="org-workspace-access">
      <div className="org-workspace-access-toolbar">
        <Input
          type="text"
          placeholder="Search organizations..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          disabled={disabled}
        />
        <span className="small text-muted">
          {selectedCount} workspace{selectedCount === 1 ? "" : "s"} selected
        </span>
      </div>

      <StyledTable>
        <thead>
          <tr>
            <th style={{ width: 44 }} />
            <th>Organization</th>
            <th style={{ width: 180 }}>Selected Workspaces</th>
            <th style={{ width: 110 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredOrganizations.map((organization) => {
            const orgId = String(organization.organization_id);
            const organizationWorkspaces = workspacesByOrganization.get(orgId) ?? [];
            const selectedInOrg = organizationWorkspaces.filter((workspace) =>
              selectedWorkspaceIds.has(String(workspace.workspace_id))
            ).length;
            const isExpanded = Boolean(expandedOrgIds[orgId]);

            return (
              <React.Fragment key={orgId}>
                <tr className="org-row">
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-light"
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? `Collapse ${organization.name}` : `Expand ${organization.name}`}
                      disabled={disabled}
                      onClick={() => toggleOrganizationExpanded(orgId)}
                    >
                      {isExpanded ? "▾" : "▸"}
                    </button>
                  </td>
                  <td>
                    <div className="fw-semibold">{organization.name}</div>
                    {organization.slug ? <div className="text-muted small">{organization.slug}</div> : null}
                  </td>
                  <td>
                    <span className="badge text-bg-light">
                      {selectedInOrg}/{organizationWorkspaces.length}
                    </span>
                  </td>
                  <td>
                    {organization.is_active ? (
                      <span className="badge text-bg-success">Active</span>
                    ) : (
                      <span className="badge text-bg-secondary">Inactive</span>
                    )}
                  </td>
                </tr>

                {isExpanded ? (
                  <tr>
                    <td colSpan={4} className="org-workspace-expand-cell">
                      {organizationWorkspaces.length === 0 ? (
                        <div className="text-muted small px-2 py-2">No workspaces found in this organization.</div>
                      ) : (
                        <table className="table table-sm mb-0 org-workspace-subtable">
                          <thead>
                            <tr>
                              <th style={{ width: 42 }} />
                              <th>Workspace</th>
                              <th>Datasource</th>
                              <th style={{ width: 110 }}>Default</th>
                            </tr>
                          </thead>
                          <tbody>
                            {organizationWorkspaces.map((workspace) => {
                              const workspaceId = String(workspace.workspace_id);
                              const selected = selectedWorkspaceIds.has(workspaceId);
                              const isDefault = selectedMap[workspaceId] === true;
                              return (
                                <tr key={workspaceId}>
                                  <td>
                                    <Input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => toggleWorkspace(workspaceId)}
                                      disabled={disabled}
                                      aria-label={`Select workspace ${workspace.workspace_name}`}
                                    />
                                  </td>
                                  <td>
                                    <div className="fw-semibold">{workspace.workspace_name}</div>
                                    <div className="text-muted small">{workspace.workspace_id}</div>
                                  </td>
                                  <td>
                                    {workspace.datasource_name ?? "-"}
                                    {workspace.datasource_type ? (
                                      <span className="text-muted small"> ({workspace.datasource_type})</span>
                                    ) : null}
                                  </td>
                                  <td>
                                    <Input
                                      type="radio"
                                      name="default-workspace-selection"
                                      checked={isDefault}
                                      disabled={disabled || !selected}
                                      onChange={() => setDefaultWorkspace(workspaceId)}
                                      aria-label={`Set ${workspace.workspace_name} as default`}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}

          {filteredOrganizations.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center text-muted py-3">
                No organizations matched your search.
              </td>
            </tr>
          ) : null}
        </tbody>
      </StyledTable>
    </div>
  );
};

export default OrganizationWorkspaceAccess;
