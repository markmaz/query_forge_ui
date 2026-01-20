import React, { useState } from 'react';
import { Input } from 'reactstrap';
import StyledTable from '../../../../shared/ui/StyledTable';
import { CubeIcon } from '@heroicons/react/24/outline';

import type { Product } from '../../../../entities/Products';
import type { ProductRole } from '../../../../entities/ProductRole';
import type { ProductGroup } from '../../../../entities/ProductGroup';

type ValueMap = Record<string, string>; // product_id -> product_role_id | "None"

type Props = {
  /** Groups with products & roles */
  groups: ProductGroup[];

  /** Controlled value: product_id -> product_role_id | "None" */
  value: ValueMap;

  /** Controlled updater */
  onChange: (next: ValueMap) => void;

  /** Optional default expanded/collapsed groups */
  defaultExpanded?: Record<string, boolean>;

  /** Called when we want to surface non-blocking info to the user (e.g., toast) */
  onInfo?: (msg: string) => void;

  /** Optional: hide group “apply to all” dropdown */
  hideGroupApply?: boolean;
};

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
      const rname = pr.role?.role_name || '';
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

const TOTAL_COLS = 3;

const ProductRoleSelector: React.FC<Props> = ({
  groups,
  value,
  onChange,
  defaultExpanded,
  onInfo,
  hideGroupApply = false,
}) => {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(defaultExpanded || {});
  const [groupRoleChoice, setGroupRoleChoice] = useState<Record<string, string>>({}); // '' | 'None' | role_id

  const toggleOpen = (groupId: string) =>
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));

  const handleProductRoleChange = (productId: string, productRoleId: string) => {
    onChange({ ...value, [productId]: productRoleId });
  };

  /** Apply a group dropdown choice:
   *  - "None" => clear all product selections in the group
   *  - role_id => set each product to its corresponding product_role_id if present;
   *               onInfo(...) for products that don't have that role.
   */
  const applyGroupRoleToProducts = (group: ProductGroup, roleChoice: string, roleLabel?: string) => {
    const products = dedupeProducts(group.products || []);

    if (roleChoice === 'None') {
      const next = { ...value };
      for (const p of products) next[String(p.product_id)] = 'None';
      onChange(next);
      onInfo?.(`Cleared roles for ${products.length} product(s) in “${group.product_group_name}”.`);
      return;
    }

    // roleChoice is a role_id
    const next = { ...value };
    const missing: string[] = [];
    for (const p of products) {
      const match = (p.roles || []).find(r => r.role?.role_id === roleChoice);
      if (match) next[String(p.product_id)] = String(match.product_role_id);
      else missing.push(p.product_name);
    }
    onChange(next);

    if (missing.length > 0) {
      onInfo?.(
        `${missing.length} product(s) in “${group.product_group_name}” do not have the “${roleLabel || 'selected'}” role.`
      );
    }
  };

  return (
    <StyledTable>
      <thead>
        <tr>
          <th style={{ width: 36 }}></th>
          <th>Product Group</th>
          {!hideGroupApply && <th>Apply Role to All</th>}
          {hideGroupApply && <th></th>}
        </tr>
      </thead>
      <tbody>
        {groups.map((group) => {
          const open = !!openGroups[group.product_group_id];
          const products = dedupeProducts(group.products || []);
          const commonRoles = commonRolesForGroup(group);
          const groupValue = groupRoleChoice[group.product_group_id] ?? '';

          return (
            <React.Fragment key={group.product_group_id}>
              {/* Group row */}
              <tr>
                <td>
                  <button
                    type="button"
                    className="btn btn-sm btn-light"
                    aria-expanded={open}
                    aria-label={open ? 'Collapse group' : 'Expand group'}
                    onClick={() => toggleOpen(group.product_group_id)}
                    style={{ lineHeight: 1, padding: '2px 6px' }}
                  >
                    {open ? '▾' : '▸'}
                  </button>
                </td>
                <td>{group.product_group_name}</td>
                <td>
                  {!hideGroupApply && (
                    <Input
                      type="select"
                      value={groupValue}
                      onChange={(e) => {
                        const rid = e.target.value; // '' | 'None' | role_id
                        setGroupRoleChoice(prev => ({ ...prev, [group.product_group_id]: rid }));

                        if (rid === '') return; // placeholder; do nothing
                        if (rid === 'None') {
                          applyGroupRoleToProducts(group, 'None');
                          return;
                        }
                        const label = commonRoles.find(r => r.role_id === rid)?.role_name || '';
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
                  )}
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
                        <table className="table table-sm mb-0" style={{ tableLayout: 'fixed', width: '100%' }}>
                          <colgroup>
                            <col style={{ width: '55%' }} />
                            <col style={{ width: '45%' }} />
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
                                    value={String(value[String(p.product_id)] ?? 'None')}
                                    onChange={(e) => handleProductRoleChange(String(p.product_id), e.target.value)}
                                  >
                                    <option value="None">None</option>
                                    {(p.roles || []).map((pr: ProductRole) => (
                                      <option key={String(pr.product_role_id)} value={String(pr.product_role_id)}>
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
  );
};

export default ProductRoleSelector;

/** Helper you can optionally export for other places (e.g., to build payloads) */
export function mergeAllProductsFromGroups(groups: ProductGroup[]): Product[] {
  return groups.flatMap(g => dedupeProducts(g.products || []));
}
