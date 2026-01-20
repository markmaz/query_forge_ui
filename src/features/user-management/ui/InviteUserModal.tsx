import React, { useEffect, useMemo, useState } from "react";
import {
  Modal, ModalHeader, ModalBody, ModalFooter,
  Button, FormGroup, Label, Input, Spinner
} from "reactstrap";

import StyledTable from "../../../shared/ui/StyledTable";
import { CubeIcon } from "@heroicons/react/24/outline";
import WorkspaceTable from "../../workspaces/ui/WorkspaceTable";
import type { WorkspaceSelection } from "../../workspaces/ui/WorkspaceTable";

import type { UserProfileUpdate, UserProfile } from "../../../entities/Users";
import type { Product } from "../../../entities/Products";
import type { ProductRole } from "../../../entities/ProductRole";
import type { ProductGroup } from "../../../entities/ProductGroup";

import { useQuery } from "@tanstack/react-query";
import { fetchProductGroups } from "../../../shared/api/productGroup";
import { toast } from "react-toastify";

/** Merge duplicate products (same product_id) and union their roles */
function dedupeProducts(products: Product[] = []): Product[] {
  const byId = new Map<string, Product>();
  for (const p of products) {
    const id = p.product_id;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { ...p, roles: [...(p.roles ?? [])] });
    } else {
      const seen = new Set((existing.roles ?? []).map(r => r.product_role_id));
      const merged = [...(existing.roles ?? [])];
      for (const r of p.roles ?? []) {
        if (!seen.has(r.product_role_id)) {
          seen.add(r.product_role_id);
          merged.push(r);
        }
      }
      byId.set(id, { ...existing, roles: merged });
    }
  }
  return [...byId.values()];
}

/** Roles that appear in EVERY product in the group (by role_id) */
function commonRolesForGroup(group: ProductGroup) {
  const products = dedupeProducts(group.products || []);
  if (products.length === 0) return [];
  const counts = new Map<string, { role_id: string; role_name: string; count: number }>();

  products.forEach((p) => {
    const seenInThis = new Set<string>();
    (p.roles || []).forEach((pr) => {
      const rid = pr.role?.role_id;
      const rname = pr.role?.role_name || "";
      if (!rid || seenInThis.has(rid)) return;
      seenInThis.add(rid);
      const curr = counts.get(rid);
      if (!curr) counts.set(rid, { role_id: rid, role_name: rname, count: 1 });
      else curr.count += 1;
    });
  });

  const total = products.length;
  return Array.from(counts.values())
    .filter(r => r.count === total)
    .map(({ role_id, role_name }) => ({ role_id, role_name }));
}

type Props = {
  isOpen: boolean;
  toggle: () => void;
  mode?: "invite" | "edit";
  userProfile?: UserProfile;                    // prefill if editing
  onSave: (payload: UserProfileUpdate) => void; // returns your update type
};

const TOTAL_COLS = 3;

const UserModal: React.FC<Props> = ({
  isOpen,
  toggle,
  userProfile,
  mode = "invite",
  onSave,
}) => {
  const [email, setEmail] = useState<string>("");
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<WorkspaceSelection[]>([]);
  const [productRoles, setProductRoles] = useState<Record<string, string>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  // NEW: keep the selected group dropdown value per group ('' | 'None' | role_id)
  const [groupRoleChoice, setGroupRoleChoice] = useState<Record<string, string>>({});

  const [emailError, setEmailError] = useState("");
  const [productError, setProductError] = useState("");
  const [orgError, setOrgError] = useState("");

  const { data: groups = [], isLoading: groupsLoading, isError: groupsError } = useQuery<ProductGroup[], Error>({
    queryKey: ["productGroups", "All"],
    queryFn: () => fetchProductGroups("All"),
    enabled: isOpen,
    initialData: [],
    placeholderData: (prev) => prev ?? [],
    select: (raw) => (Array.isArray(raw) ? raw : []),
  });

  const allProducts: Product[] = useMemo(
    () => groups.flatMap(g => dedupeProducts(g.products || [])),
    [groups]
  );

  const roleLookups = useMemo(() => {
    const map: Record<string, {
      byRoleId: Record<string, string>;
      byProductRoleId: Record<string, string>;
    }> = {};
    allProducts.forEach((p) => {
      const byRoleId: Record<string, string> = {};
      const byProductRoleId: Record<string, string> = {};
      (p.roles || []).forEach((pr) => {
        if (pr.role?.role_id) byRoleId[String(pr.role.role_id)] = String(pr.product_role_id);
        byProductRoleId[String(pr.product_role_id)] = String(pr.product_role_id);
      });
      map[String(p.product_id)] = { byRoleId, byProductRoleId };
    });
    return map;
  }, [allProducts]);

  useEffect(() => {
    if (!isOpen) return;
    setEmailError("");
    setProductError("");
    setOrgError("");
    setOpenGroups({});
    setGroupRoleChoice({}); // reset group dropdowns

    if (userProfile) {
      setEmail(userProfile.email ?? "");
      setSelectedWorkspaces(
        (userProfile.workspaces ?? []).map((w) => ({
          workspace_id: String(w.workspace_id),
          is_default: !!w.is_default,
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
    allProducts.forEach((p) => { defaults[String(p.product_id)] = "None"; });

    if (userProfile) {
      const prefilled = { ...defaults };
      for (const up of userProfile.products ?? []) {
        const pid = String(up.product_id ?? "");
        if (!pid) continue;
        const look = roleLookups[pid];
        if (!look) continue;

        const first = (up.roles ?? [])[0];
        if (!first) continue;

        let resolved: string | undefined;
        const maybePR = (first as any).product_role_id;
        if (maybePR != null) resolved = look.byProductRoleId[String(maybePR)];
        if (!resolved && first.role?.role_id != null) {
          resolved = look.byRoleId[String(first.role.role_id)];
        }
        prefilled[pid] = resolved ?? "None";
      }
      setProductRoles(prefilled);
    } else {
      setProductRoles(defaults);
    }
  }, [isOpen, allProducts, roleLookups, userProfile]);

  const toggleOpen = (groupId: string) =>
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));

  const handleProductRoleChange = (productId: string, productRoleId: string) => {
    setProductRoles((prev) => ({ ...prev, [productId]: productRoleId }));
  };

  /** Apply a group dropdown choice:
   *  - "None" => clear all product selections in the group
   *  - role_id => set each product to its corresponding product_role_id if present;
   *               toast info for products that don't have that role.
   */
  const applyGroupRoleToProducts = (group: ProductGroup, roleChoice: string, roleLabel?: string) => {
    const products = dedupeProducts(group.products || []);

    if (roleChoice === "None") {
      setProductRoles((prev) => {
        const next = { ...prev };
        for (const p of products) next[String(p.product_id)] = "None";
        return next;
      });
      toast.info(`Cleared roles for ${products.length} product(s) in “${group.product_group_name}”.`);
      return;
    }

    // roleChoice is a role_id
    const missing: string[] = [];
    setProductRoles((prev) => {
      const next = { ...prev };
      for (const p of products) {
        const match = (p.roles || []).find(r => r.role?.role_id === roleChoice);
        if (match) next[String(p.product_id)] = String(match.product_role_id);
        else missing.push(p.product_name);
      }
      return next;
    });

    if (missing.length > 0) {
      toast.info(
        `${missing.length} product(s) in “${group.product_group_name}” do not have the “${roleLabel || 'selected'}” role.`
      );
    }
  };

  const handleSubmit = () => {
    setEmailError(""); setProductError(""); setOrgError("");

    let ok = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address.");
      ok = false;
    }

    const selectedProducts: Product[] = [];
    for (const p of allProducts) {
      const chosenProductRoleId = productRoles[String(p.product_id)];
      if (!chosenProductRoleId || chosenProductRoleId === "None") continue;

      const chosenRole: ProductRole | undefined = (p.roles || []).find(
        (r) => String(r.product_role_id) === String(chosenProductRoleId)
      );
      if (!chosenRole) continue;

      selectedProducts.push({
        product_id: p.product_id,
        product_name: p.product_name,
        status: p.status,
        last_update: p.last_update,
        roles: [chosenRole],
      });
    }

    if (selectedProducts.length === 0) {
      setProductError("Please assign at least one product role.");
      ok = false;
    }

    if (selectedWorkspaces.length === 0) {
      setOrgError("Please select at least one organization.");
      ok = false;
    }

    if (!ok) return;

    const payload: UserProfileUpdate = {
      user_id: userProfile?.user_id ?? null,
      email,
      products: selectedProducts,
      workspaces: selectedWorkspaces,
    };

    onSave(payload);
    toggle();
  };

  const headerText = mode === "edit" ? "Edit User" : "Invite User";

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="lg">
      <ModalHeader toggle={toggle}>{headerText}</ModalHeader>
      <ModalBody>
        {/* Email */}
        <FormGroup>
          <Label htmlFor="userEmail">Email</Label>
          <Input
            type="email"
            id="userEmail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter user email"
            invalid={!!emailError}
          />
          {emailError && <small className="text-danger">{emailError}</small>}
        </FormGroup>

        {/* Products by Group */}
        <Label className="mt-3">Assign Product Roles</Label>

        {groupsLoading ? (
          <div className="d-flex align-items-center gap-2 mt-2">
            <Spinner size="sm" /> Loading product catalog…
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
                const open = !!openGroups[group.product_group_id];
                const products = dedupeProducts(group.products || []);
                const commonRoles = commonRolesForGroup(group);
                const groupValue = groupRoleChoice[group.product_group_id] ?? "";

                return (
                  <React.Fragment key={group.product_group_id}>
                    {/* Group row */}
                    <tr>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-light"
                          aria-expanded={open}
                          aria-label={open ? "Collapse group" : "Expand group"}
                          onClick={() => toggleOpen(group.product_group_id)}
                          style={{ lineHeight: 1, padding: "2px 6px" }}
                        >
                          {open ? "▾" : "▸"}
                        </button>
                      </td>
                      <td>{group.product_group_name}</td>
                      <td>
                        <Input
                          type="select"
                          value={groupValue}
                          onChange={(e) => {
                            const rid = e.target.value; // '' | 'None' | role_id
                            setGroupRoleChoice(prev => ({ ...prev, [group.product_group_id]: rid }));

                            if (rid === "") return; // placeholder; do nothing
                            if (rid === "None") {
                              applyGroupRoleToProducts(group, "None");
                              return;
                            }
                            const label = commonRoles.find(r => r.role_id === rid)?.role_name || "";
                            applyGroupRoleToProducts(group, rid, label);
                          }}
                        >
                          <option value="">— Select a role for all —</option>
                          <option value="None">None</option>
                          {commonRoles.map((r) => (
                            <option key={r.role_id} value={r.role_id}>
                              {r.role_name}
                            </option>
                          ))}
                        </Input>
                      </td>
                    </tr>

                    {/* Expanded products */}
                    {open && (
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
                                  {products.map((p) => (
                                    <tr key={p.product_id}>
                                      <td className="d-flex align-items-center gap-2">
                                        <CubeIcon width={40} height={20} />
                                        <span className="text-nowrap">{p.product_name}</span>
                                      </td>
                                      <td>
                                        <Input
                                          type="select"
                                          value={String(productRoles[String(p.product_id)] ?? "None")}
                                          onChange={(e) =>
                                            handleProductRoleChange(String(p.product_id), e.target.value)
                                          }
                                        >
                                          <option value="None">None</option>
                                          {(p.roles || []).map((pr) => (
                                            <option
                                              key={String(pr.product_role_id)}
                                              value={String(pr.product_role_id)}
                                            >
                                              {pr.role?.role_name}
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
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </StyledTable>
        )}
        {productError && <div className="text-danger mt-2">{productError}</div>}

        {/* Workspaces */}
        <div className="mt-4">
          <WorkspaceTable
            selected={selectedWorkspaces}
            onSelectionChange={(sel) => setSelectedWorkspaces(sel)}
          />
          {orgError && <div className="text-danger mt-2">{orgError}</div>}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button color="primary" onClick={handleSubmit}>
          {mode === "edit" ? "Save Changes" : "Send Invite"}
        </Button>
        <Button color="secondary" onClick={toggle}>Cancel</Button>
      </ModalFooter>
    </Modal>
  );
};

export default UserModal;
