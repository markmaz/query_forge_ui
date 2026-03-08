import React, { useMemo, useState } from "react";
import { CubeIcon } from "@heroicons/react/24/outline";
import { Input } from "reactstrap";
import StyledTable from "../../../../shared/components/StyledTable";

import type { Product } from "../../../../domain-model/Products";
import type { ProductGroup } from "../../../../domain-model/ProductGroup";
import type { ProductRole } from "../../../../domain-model/ProductRole";

type ValueMap = Record<string, string>;

type Props = {
  groups: ProductGroup[];
  value: ValueMap;
  onChange: (next: ValueMap) => void;
  defaultExpanded?: Record<string, boolean>;
  onInfo?: (msg: string) => void;
  hideGroupApply?: boolean;
};

const TABLE_COLUMNS = 3;

function mergeProducts(products: Product[] = []): Product[] {
  const byId = new Map<string, Product>();

  products.forEach((product) => {
    const id = product.product_id;
    const existing = byId.get(id);

    if (!existing) {
      byId.set(id, { ...product, roles: [...(product.roles ?? [])] });
      return;
    }

    const mergedRoles = [...(existing.roles ?? [])];
    const seen = new Set(mergedRoles.map((role) => role.product_role_id));

    (product.roles ?? []).forEach((role) => {
      if (seen.has(role.product_role_id)) return;
      seen.add(role.product_role_id);
      mergedRoles.push(role);
    });

    byId.set(id, { ...existing, roles: mergedRoles });
  });

  return [...byId.values()];
}

function findCommonRoles(group: ProductGroup) {
  const products = mergeProducts(group.products || []);
  if (products.length === 0) return [] as Array<{ role_id: string; role_name: string }>;

  const countByRoleId = new Map<string, { role_id: string; role_name: string; count: number }>();

  products.forEach((product) => {
    const seenForProduct = new Set<string>();

    (product.roles || []).forEach((productRole) => {
      const roleId = productRole.role?.role_id;
      const roleName = productRole.role?.role_name || "";
      if (!roleId || seenForProduct.has(roleId)) return;

      seenForProduct.add(roleId);
      const current = countByRoleId.get(roleId);
      if (!current) {
        countByRoleId.set(roleId, { role_id: roleId, role_name: roleName, count: 1 });
      } else {
        current.count += 1;
      }
    });
  });

  return Array.from(countByRoleId.values())
    .filter((item) => item.count === products.length)
    .map(({ role_id, role_name }) => ({ role_id, role_name }));
}

const ProductRoleSelector: React.FC<Props> = ({
  groups,
  value,
  onChange,
  defaultExpanded,
  onInfo,
  hideGroupApply = false,
}) => {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(defaultExpanded || {});
  const [groupSelection, setGroupSelection] = useState<Record<string, string>>({});

  const productsByGroup = useMemo(() => {
    const map = new Map<string, Product[]>();
    groups.forEach((group) => map.set(group.product_group_id, mergeProducts(group.products || [])));
    return map;
  }, [groups]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((previous) => ({ ...previous, [groupId]: !previous[groupId] }));
  };

  const changeProductRole = (productId: string, productRoleId: string) => {
    onChange({ ...value, [productId]: productRoleId });
  };

  const applyGroupRole = (
    group: ProductGroup,
    roleChoice: string,
    roleLabel?: string
  ) => {
    const products = productsByGroup.get(group.product_group_id) ?? [];

    if (roleChoice === "None") {
      const next = { ...value };
      products.forEach((product) => {
        next[String(product.product_id)] = "None";
      });
      onChange(next);
      onInfo?.(`Cleared roles for ${products.length} product(s) in “${group.product_group_name}”.`);
      return;
    }

    const next = { ...value };
    const missing: string[] = [];

    products.forEach((product) => {
      const matched = (product.roles || []).find((role) => role.role?.role_id === roleChoice);
      if (matched) {
        next[String(product.product_id)] = String(matched.product_role_id);
      } else {
        missing.push(product.product_name);
      }
    });

    onChange(next);

    if (missing.length > 0) {
      onInfo?.(
        `${missing.length} product(s) in “${group.product_group_name}” do not have the “${
          roleLabel || "selected"
        }” role.`
      );
    }
  };

  return (
    <StyledTable>
      <thead>
        <tr>
          <th style={{ width: 36 }} />
          <th>Product Group</th>
          <th>{hideGroupApply ? "" : "Apply Role to All"}</th>
        </tr>
      </thead>

      <tbody>
        {groups.map((group) => {
          const groupId = group.product_group_id;
          const products = productsByGroup.get(groupId) ?? [];
          const groupRoles = findCommonRoles(group);
          const groupChoice = groupSelection[groupId] ?? "";
          const expanded = Boolean(openGroups[groupId]);

          return (
            <React.Fragment key={groupId}>
              <tr>
                <td>
                  <button
                    type="button"
                    className="btn btn-sm btn-light"
                    aria-expanded={expanded}
                    aria-label={expanded ? "Collapse group" : "Expand group"}
                    onClick={() => toggleGroup(groupId)}
                    style={{ lineHeight: 1, padding: "2px 6px" }}
                  >
                    {expanded ? "▾" : "▸"}
                  </button>
                </td>

                <td>{group.product_group_name}</td>

                <td>
                  {hideGroupApply ? null : (
                    <Input
                      type="select"
                      value={groupChoice}
                      onChange={(event) => {
                        const roleChoice = event.target.value;
                        setGroupSelection((previous) => ({ ...previous, [groupId]: roleChoice }));

                        if (!roleChoice) return;
                        if (roleChoice === "None") {
                          applyGroupRole(group, "None");
                          return;
                        }

                        const label = groupRoles.find((role) => role.role_id === roleChoice)?.role_name;
                        applyGroupRole(group, roleChoice, label);
                      }}
                    >
                      <option value="">— Select a role for all —</option>
                      <option value="None">None</option>
                      {groupRoles.map((role) => (
                        <option key={role.role_id} value={role.role_id}>
                          {role.role_name}
                        </option>
                      ))}
                    </Input>
                  )}
                </td>
              </tr>

              {expanded ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS} className="bg-light">
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
                                    value={String(value[String(product.product_id)] ?? "None")}
                                    onChange={(event) =>
                                      changeProductRole(String(product.product_id), event.target.value)
                                    }
                                  >
                                    <option value="None">None</option>
                                    {(product.roles || []).map((role: ProductRole) => (
                                      <option
                                        key={String(role.product_role_id)}
                                        value={String(role.product_role_id)}
                                      >
                                        {role.role?.role_name}
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
  );
};

export default ProductRoleSelector;

export function mergeAllProductsFromGroups(groups: ProductGroup[]): Product[] {
  return groups.flatMap((group) => mergeProducts(group.products || []));
}
