import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, FormGroup, Input, Label, Spinner } from "reactstrap";
import { useQuery } from "@tanstack/react-query";
import { CubeIcon } from "@heroicons/react/24/outline";
import { toast } from "react-toastify";

import StyledTable from "../../../shared/ui/StyledTable";
import WorkspaceTable from "../../workspaces/ui/WorkspaceTable";
import type { WorkspaceSelection } from "../../workspaces/ui/WorkspaceTable";
import type { UserProfile, UserProfileUpdate } from "../../../entities/Users";
import type { Product } from "../../../entities/Products";
import type { ProductRole } from "../../../entities/ProductRole";
import type { ProductGroup } from "../../../entities/ProductGroup";
import { fetchProductGroups } from "../../../shared/services/productGroup";
import { fetchDomainUsers, fetchDomains, type Domain } from "../../../shared/services/noCodeAdminApi";
import { isAdmin } from "../../../shared/services/auth";
import { getAccessToken } from "../../../shared/lib/accessTokenStore";
import UserAccessRolesSection from "./UserAccessRolesSection";
import "./InviteUserDrawer.css";

export type DomainAccessLevel = "none" | "reader" | "editor";

export type UserDomainAccessDraft = {
  desired: Record<string, DomainAccessLevel>;
  baseline: Record<string, DomainAccessLevel>;
};

export type UserDirectRolesDraft = {
  baselineRoleIds: string[];
  selectedRoleIds: string[];
  hasChanges: boolean;
};

type Props = {
  isOpen: boolean;
  toggle: () => void;
  mode?: "invite" | "edit";
  userProfile?: UserProfile;
  onSave: (
    payload: UserProfileUpdate,
    domainAccess: UserDomainAccessDraft,
    directRoles: UserDirectRolesDraft | null
  ) => Promise<void>;
};

type DomainProfileChoice = "custom" | "none" | "read_all" | "edit_all";

const TOTAL_COLS = 3;

function dedupeProducts(products: Product[] = []): Product[] {
  const byId = new Map<string, Product>();
  for (const product of products) {
    const existing = byId.get(product.product_id);
    if (!existing) {
      byId.set(product.product_id, { ...product, roles: [...(product.roles ?? [])] });
      continue;
    }
    const seen = new Set((existing.roles ?? []).map((role) => role.product_role_id));
    const merged = [...(existing.roles ?? [])];
    for (const role of product.roles ?? []) {
      if (seen.has(role.product_role_id)) continue;
      seen.add(role.product_role_id);
      merged.push(role);
    }
    byId.set(product.product_id, { ...existing, roles: merged });
  }
  return [...byId.values()];
}

function commonRolesForGroup(group: ProductGroup) {
  const products = dedupeProducts(group.products || []);
  if (products.length === 0) return [];

  const counts = new Map<string, { role_id: string; role_name: string; count: number }>();
  products.forEach((product) => {
    const seenInProduct = new Set<string>();
    (product.roles || []).forEach((productRole) => {
      const roleId = productRole.role?.role_id;
      const roleName = productRole.role?.role_name ?? "";
      if (!roleId || seenInProduct.has(roleId)) return;
      seenInProduct.add(roleId);
      const current = counts.get(roleId);
      if (!current) {
        counts.set(roleId, { role_id: roleId, role_name: roleName, count: 1 });
      } else {
        current.count += 1;
      }
    });
  });

  return [...counts.values()]
    .filter((role) => role.count === products.length)
    .map(({ role_id, role_name }) => ({ role_id, role_name }));
}

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
  const canEditDirectRoles = isAdmin(getAccessToken());
  const isEditMode = mode === "edit" && Boolean(userProfile?.user_id);

  const [email, setEmail] = useState("");
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<WorkspaceSelection[]>([]);
  const [productRoles, setProductRoles] = useState<Record<string, string>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [groupRoleChoice, setGroupRoleChoice] = useState<Record<string, string>>({});

  const [domainSearch, setDomainSearch] = useState("");
  const [domainProfileChoice, setDomainProfileChoice] = useState<DomainProfileChoice>("custom");
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [domainAccess, setDomainAccess] = useState<Record<string, DomainAccessLevel>>({});
  const [baselineDomainAccess, setBaselineDomainAccess] = useState<Record<string, DomainAccessLevel>>({});
  const [directRolesDraft, setDirectRolesDraft] = useState<UserDirectRolesDraft | null>(null);

  const [emailError, setEmailError] = useState("");
  const [productError, setProductError] = useState("");
  const [orgError, setOrgError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const initDomainStateKeyRef = useRef("");

  const { data: groups = [], isLoading: groupsLoading, isError: groupsError } = useQuery<ProductGroup[], Error>({
    queryKey: ["productGroups", "All"],
    queryFn: () => fetchProductGroups("All"),
    enabled: isOpen,
    initialData: [],
    placeholderData: (prev) => prev ?? [],
    select: (raw) => (Array.isArray(raw) ? raw : []),
  });

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

  const allProducts = useMemo(
    () => groups.flatMap((group) => dedupeProducts(group.products || [])),
    [groups]
  );

  const roleLookups = useMemo(() => {
    const map: Record<string, { byRoleId: Record<string, string>; byProductRoleId: Record<string, string> }> = {};
    allProducts.forEach((product) => {
      const byRoleId: Record<string, string> = {};
      const byProductRoleId: Record<string, string> = {};
      (product.roles || []).forEach((productRole) => {
        if (productRole.role?.role_id) {
          byRoleId[String(productRole.role.role_id)] = String(productRole.product_role_id);
        }
        byProductRoleId[String(productRole.product_role_id)] = String(productRole.product_role_id);
      });
      map[String(product.product_id)] = { byRoleId, byProductRoleId };
    });
    return map;
  }, [allProducts]);

  useEffect(() => {
    if (!isOpen) {
      initDomainStateKeyRef.current = "";
      return;
    }
    setEmailError("");
    setProductError("");
    setOrgError("");
    setSaveError("");
    setOpenGroups({});
    setGroupRoleChoice({});
    setDirectRolesDraft(null);

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
    if (!isOpen) return;
    const defaults: Record<string, string> = {};
    allProducts.forEach((product) => {
      defaults[String(product.product_id)] = "None";
    });

    if (userProfile) {
      const prefilled = { ...defaults };
      for (const userProduct of userProfile.products ?? []) {
        const productId = String(userProduct.product_id ?? "");
        if (!productId) continue;
        const lookup = roleLookups[productId];
        if (!lookup) continue;
        const firstRole = (userProduct.roles ?? [])[0];
        if (!firstRole) continue;

        let resolved: string | undefined;
        const maybeProductRoleId = (firstRole as { product_role_id?: string }).product_role_id;
        if (maybeProductRoleId != null) {
          resolved = lookup.byProductRoleId[String(maybeProductRoleId)];
        }
        if (!resolved && firstRole.role?.role_id != null) {
          resolved = lookup.byRoleId[String(firstRole.role.role_id)];
        }
        prefilled[productId] = resolved ?? "None";
      }
      setProductRoles(prefilled);
      return;
    }

    setProductRoles(defaults);
  }, [isOpen, allProducts, roleLookups, userProfile]);

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

  const allFilteredSelected =
    filteredDomainIds.length > 0 && filteredDomainIds.every((domainId) => selectedDomainIds.includes(domainId));

  const toggleGroup = (groupId: string) =>
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));

  const handleProductRoleChange = (productId: string, productRoleId: string) => {
    setProductRoles((prev) => ({ ...prev, [productId]: productRoleId }));
  };

  const applyGroupRoleToProducts = (group: ProductGroup, roleChoice: string, roleLabel?: string) => {
    const products = dedupeProducts(group.products || []);

    if (roleChoice === "None") {
      setProductRoles((prev) => {
        const next = { ...prev };
        products.forEach((product) => {
          next[String(product.product_id)] = "None";
        });
        return next;
      });
      toast.info(`Cleared roles for ${products.length} product(s) in "${group.product_group_name}".`);
      return;
    }

    const missing: string[] = [];
    setProductRoles((prev) => {
      const next = { ...prev };
      products.forEach((product) => {
        const matched = (product.roles || []).find((role) => role.role?.role_id === roleChoice);
        if (!matched) {
          missing.push(product.product_name);
          return;
        }
        next[String(product.product_id)] = String(matched.product_role_id);
      });
      return next;
    });

    if (missing.length > 0) {
      toast.info(
        `${missing.length} product(s) in "${group.product_group_name}" do not have the "${roleLabel || "selected"}" role.`
      );
    }
  };

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
    setProductError("");
    setOrgError("");
    setSaveError("");

    let isValid = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address.");
      isValid = false;
    }

    const selectedProducts: Product[] = [];
    allProducts.forEach((product) => {
      const selectedProductRoleId = productRoles[String(product.product_id)];
      if (!selectedProductRoleId || selectedProductRoleId === "None") return;
      const selectedRole = (product.roles || []).find(
        (role) => String(role.product_role_id) === String(selectedProductRoleId)
      );
      if (!selectedRole) return;
      selectedProducts.push({
        product_id: product.product_id,
        product_name: product.product_name,
        status: product.status,
        last_update: product.last_update,
        roles: [selectedRole],
      });
    });

    if (selectedProducts.length === 0) {
      setProductError("Please assign at least one product role.");
      isValid = false;
    }

    if (selectedWorkspaces.length === 0) {
      setOrgError("Please select at least one organization.");
      isValid = false;
    }

    if (!isValid) return;

    const payload: UserProfileUpdate = {
      user_id: userProfile?.user_id ?? null,
      email,
      products: selectedProducts,
      workspaces: selectedWorkspaces,
    };

    setIsSaving(true);
    try {
      await onSave(payload, {
        desired: domainAccess,
        baseline: baselineDomainAccess,
      }, directRolesDraft);
      toggle();
    } catch (error) {
      setSaveError(toSaveErrorMessage(error, "Unable to save user access."));
    } finally {
      setIsSaving(false);
    }
  };

  const headerText = mode === "edit" ? "Edit User" : "Invite User";

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
          <h5 className="offcanvas-title mb-0">{headerText}</h5>
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
            </div>
            <FormGroup className="mb-0">
              <Label htmlFor="userEmail">Email</Label>
              <Input
                type="email"
                id="userEmail"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter user email"
                invalid={Boolean(emailError)}
                disabled={isSaving}
              />
              {emailError ? <small className="text-danger">{emailError}</small> : null}
            </FormGroup>
          </section>

          <section className="user-mgmt-section">
            <div className="user-mgmt-section-header">
              <h6 className="mb-0">Product Access</h6>
              <span className="small text-muted">Assign product roles by group.</span>
            </div>
            {groupsLoading ? (
              <div className="d-flex align-items-center gap-2 mt-2">
                <Spinner size="sm" /> Loading product catalog...
              </div>
            ) : groupsError ? (
              <div className="text-danger mt-2">Failed to load product groups.</div>
            ) : (
              <StyledTable>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}></th>
                    <th>Product Group</th>
                    <th>Apply Role to All</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => {
                    const open = Boolean(openGroups[group.product_group_id]);
                    const products = dedupeProducts(group.products || []);
                    const commonRoles = commonRolesForGroup(group);
                    const groupValue = groupRoleChoice[group.product_group_id] ?? "";
                    return (
                      <React.Fragment key={group.product_group_id}>
                        <tr>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-light"
                              aria-expanded={open}
                              aria-label={open ? "Collapse group" : "Expand group"}
                              onClick={() => toggleGroup(group.product_group_id)}
                              style={{ lineHeight: 1, padding: "2px 6px" }}
                              disabled={isSaving}
                            >
                              {open ? "▾" : "▸"}
                            </button>
                          </td>
                          <td>{group.product_group_name}</td>
                          <td>
                            <Input
                              type="select"
                              value={groupValue}
                              onChange={(event) => {
                                const roleChoice = event.target.value;
                                setGroupRoleChoice((prev) => ({ ...prev, [group.product_group_id]: roleChoice }));
                                if (roleChoice === "") return;
                                if (roleChoice === "None") {
                                  applyGroupRoleToProducts(group, "None");
                                  return;
                                }
                                const roleLabel = commonRoles.find((role) => role.role_id === roleChoice)?.role_name ?? "";
                                applyGroupRoleToProducts(group, roleChoice, roleLabel);
                              }}
                              disabled={isSaving}
                            >
                              <option value="">— Select a role for all —</option>
                              <option value="None">None</option>
                              {commonRoles.map((role) => (
                                <option key={role.role_id} value={role.role_id}>
                                  {role.role_name}
                                </option>
                              ))}
                            </Input>
                          </td>
                        </tr>

                        {open ? (
                          <tr>
                            <td colSpan={TOTAL_COLS} className="bg-light">
                              {products.length === 0 ? (
                                <div className="text-muted py-2 px-2">No products in this group.</div>
                              ) : (
                                <div className="p-2">
                                  <table className="table table-sm mb-0" style={{ tableLayout: "fixed", width: "100%" }}>
                                    <colgroup>
                                      <col style={{ width: "55%" }} />
                                      <col style={{ width: "45%" }} />
                                    </colgroup>
                                    <thead>
                                      <tr>
                                        <th>Product</th>
                                        <th>Role</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {products.map((product) => (
                                        <tr key={product.product_id}>
                                          <td className="d-flex align-items-center gap-2">
                                            <CubeIcon width={40} height={20} />
                                            <span className="text-nowrap">{product.product_name}</span>
                                          </td>
                                          <td>
                                            <Input
                                              type="select"
                                              value={String(productRoles[String(product.product_id)] ?? "None")}
                                              onChange={(event) =>
                                                handleProductRoleChange(String(product.product_id), event.target.value)
                                              }
                                              disabled={isSaving}
                                            >
                                              <option value="None">None</option>
                                              {(product.roles || []).map((productRole) => (
                                                <option key={String(productRole.product_role_id)} value={String(productRole.product_role_id)}>
                                                  {productRole.role?.role_name}
                                                </option>
                                              ))}
                                            </Input>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </StyledTable>
            )}
            {productError ? <div className="text-danger mt-2">{productError}</div> : null}
          </section>

          <section className="user-mgmt-section">
            <div className="user-mgmt-section-header">
              <h6 className="mb-0">Organization Access</h6>
            </div>
            <WorkspaceTable selected={selectedWorkspaces} onSelectionChange={setSelectedWorkspaces} />
            {orgError ? <div className="text-danger mt-2">{orgError}</div> : null}
          </section>

          <section className="user-mgmt-section user-domain-access-card">
            <div className="user-mgmt-section-header">
              <h6 className="mb-0">Domain Access</h6>
              <div className="small text-muted">
                {domainCounts.editor} editor • {domainCounts.reader} reader • {domainCounts.none} none
              </div>
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
                      filteredDomains.map((domain) => {
                        const domainId = String(domain.id);
                        const level = domainAccess[domainId] ?? "none";
                        const isSelected = selectedDomainIds.includes(domainId);
                        return (
                          <tr key={domainId}>
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
                              <div className="fw-semibold">{domain.name}</div>
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
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {canEditDirectRoles ? (
            <section className="user-mgmt-section">
              <UserAccessRolesSection
                userId={mode === "edit" ? String(userProfile?.user_id ?? "") : null}
                editable={canEditDirectRoles}
                commitMode="deferred"
                onDraftChange={setDirectRolesDraft}
                title="Access Roles"
                subtitle={
                  mode === "edit"
                    ? "Manage direct user roles. Effective roles include inherited product access."
                    : "Set direct roles to apply immediately when this user accepts the invite."
                }
              />
            </section>
          ) : null}
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
