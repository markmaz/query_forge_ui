import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { RootState } from '../../../../app/providers/store';
import StyledTable from '../../../../shared/ui/StyledTable';
import { Product } from '../../../../entities/Products';
import { ProductRole } from '../../../../entities/ProductRole';
import { ProductGroup } from '../../../../entities/ProductGroup';
import { fetchUserProfile } from '../../../user-management/model/userSlice';
import { fetchProductGroups, deleteProductGroup } from '../../../../shared/services/productGroup';
import { addProductRole, updateProductStatus, removeProductRole, removeProductFromProductGroup } from '../../../../shared/services/products';
import AddRoleModal from './AddRoleModal';
import AddProductModal from './AddProductModal';
import AddGroupModal from './AddGroupModal';
import ProductActionsMenu from './ProductActionsMenu/ProductActionsMenu';
import { toast } from 'react-toastify';
import { useAppDispatch } from '../../../../shared/lib/hooks';
import './ProductTable.css';

/** Merge duplicate products (same product_id) and union their roles */
function dedupeProductsInGroup(products: Product[] = []): Product[] {
  const byId = new Map<string, Product>();
  for (const p of products) {
    const id = p.product_id;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { ...p, roles: [...(p.roles ?? [])] });
    } else {
      const seen = new Set((existing.roles ?? []).map(r => r.role?.role_id ?? r.product_role_id));
      const merged = [...(existing.roles ?? [])];
      for (const r of p.roles ?? []) {
        const rid = r.role?.role_id ?? r.product_role_id;
        if (!seen.has(rid)) {
          seen.add(rid);
          merged.push(r);
        }
      }
      byId.set(id, { ...existing, roles: merged });
    }
  }
  return [...byId.values()];
}

function roleBadgeClass(roleName?: string) {
  const n = (roleName || '').trim().toLowerCase();
  switch (n) {
    case 'admin': return 'badge qf-pm-role-badge qf-pm-role-badge-admin';
    case 'owner': return 'badge qf-pm-role-badge qf-pm-role-badge-owner';
    case 'user': return 'badge qf-pm-role-badge qf-pm-role-badge-user';
    case 'viewer':
    case 'read-only': return 'badge qf-pm-role-badge qf-pm-role-badge-viewer';
    default: return 'badge qf-pm-role-badge qf-pm-role-badge-default';
  }
}

function RoleBadges({
  roles,
  maxVisible = 3,
  onRemove,
}: {
  roles?: ProductRole[];
  maxVisible?: number;
  onRemove?: (roleId: string) => void;
}) {
  const unique = Array.from(
    new Map(
      (roles ?? []).map(r => {
        const id = r.role?.role_id ?? r.product_role_id;
        const name = r.role?.role_name ?? 'role';
        return [id, { id, name }];
      })
    ).values()
  );

  if (unique.length === 0) return <span className="text-muted">—</span>;

  const visible = unique.slice(0, maxVisible);
  const extra = unique.length - visible.length;

  return (
    <div className="d-flex flex-wrap gap-1">
      {visible.map(({ id, name }) => (
        <span key={id} className={`badge-removable ${roleBadgeClass(name)} me-1`}>
          {name}
          {onRemove && (
            <button
              type="button"
              className="btn-close btn-close-white btn-close-xs ms-1"
              aria-label={`Remove ${name}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(id);
              }}
            />
          )}
        </span>
      ))}
      {extra > 0 && <span className="badge qf-pm-role-badge qf-pm-role-badge-viewer">+{extra}</span>}
    </div>
  );
}

function StatusCell({ status }: { status?: string | null }) {
  const isActive = status === 'Active';
  const isInactive = status === 'Inactive';
  const badge = (
    <span className={`badge qf-pm-status-badge ${isActive ? 'is-active' : isInactive ? 'is-inactive' : 'is-other'}`}>
      {status ?? '—'}
    </span>
  );
  return (
    <>
      <span className={`d-inline-block d-md-none status-dot ${isActive ? 'status-active' : isInactive ? 'status-inactive' : 'status-other'}`} />
      <span className="d-none d-md-inline">{badge}</span>
    </>
  );
}

const ProductTable: React.FC = () => {
  const selectedStatus = useSelector((state: RootState) => state.statusFilter.selectedStatus);
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  const { data: productGroups = [], isPending, isError, error } = useQuery<ProductGroup[], Error>({
    queryKey: ['productGroups', selectedStatus],
    queryFn: () => fetchProductGroups(selectedStatus),
    initialData: [],
    placeholderData: (prev) => prev ?? [],
    select: (raw) => (Array.isArray(raw) ? raw : []),
  });

  // Expanded groups state
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const toggleOpen = (id: string) => setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  // Add Role modal state
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleModalProduct, setRoleModalProduct] = useState<Product | null>(null);

  // Add Product modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalGroup, setAddModalGroup] = useState<ProductGroup | null>(null);

  // Add Group modal state
  const [addGroupOpen, setAddGroupOpen] = useState(false);

  const openAddModal = (group: ProductGroup) => { setAddModalGroup(group); setAddModalOpen(true); };
  const closeAddModal = () => { setAddModalOpen(false); setAddModalGroup(null); };

  const afterSaved = () => queryClient.invalidateQueries({ queryKey: ['productGroups'] });

  // Mutations
  const addRoleMutation = useMutation({
    mutationFn: ({ productId, roleId }: { productId: string; roleId: string }) => addProductRole(productId, roleId),
    onSuccess: () => {
      toast.success('Role added');
      queryClient.invalidateQueries({ queryKey: ['productGroups'] });
      setRoleModalOpen(false);
      setRoleModalProduct(null);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to add role'),
  });

  const removeRoleMutation = useMutation({
    mutationFn: ({ productId, roleId }: { productId: string; roleId: string }) => removeProductRole(productId, roleId),
    onMutate: async ({ productId, roleId }) => {
      await queryClient.cancelQueries({ queryKey: ['productGroups'] });
      const key = ['productGroups', selectedStatus];
      const prev = queryClient.getQueryData<ProductGroup[]>(key);
      queryClient.setQueryData<ProductGroup[]>(key, (old) => {
        if (!old) return old as any;
        return old.map(g => ({
          ...g,
          products: (g.products || []).map(p => {
            if (p.product_id !== productId) return p;
            return { ...p, roles: (p.roles || []).filter(r => (r.role?.role_id ?? r.product_role_id) !== roleId) };
          })
        }));
      });
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['productGroups', selectedStatus], ctx.prev);
      if (_e) {
        toast.error(`Failed to remove role (The role is probably in use): ${_e?.message ?? 'Unknown error'}`);
      }
    },
    onSuccess: () => toast.success('Role removed'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['productGroups'] }),
  });

  const removeFromGroupMutation = useMutation({
    mutationFn: ({productId, productGroupID}: {productId: string; productGroupID: string}) =>
      removeProductFromProductGroup(productId, productGroupID),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productGroups']}),
    onError: (e: any) => toast.error(e?.message ?? 'Failed to update product'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ productId, status }: { productId: string; status: 'Active' | 'Inactive' }) =>
      updateProductStatus(productId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productGroups'] });
      dispatch(fetchUserProfile());
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to update product'),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) => deleteProductGroup(groupId),
    onSuccess: () => {
      toast.success('Group deleted');
      queryClient.invalidateQueries({ queryKey: ['productGroups'] });
    },
    onError: (e: any) => {
      // If backend blocks delete when products exist, you might see 409 or 400
      if (e?.response?.status === 409) {
        toast.error('Cannot delete group while it still has products.');
      } else {
        toast.error(e?.message ?? 'Failed to delete group');
      }
    },
  });

  const onDeleteGroup = (group: ProductGroup) => {
    const hasProducts = Array.isArray(group.products) && group.products.length > 0;
    const msg = hasProducts
      ? `Delete "${group.product_group_name}" and ALL its product mappings?`
      : `Delete "${group.product_group_name}"?`;
    if (!window.confirm(msg)) return;
    deleteGroupMutation.mutate(group.product_group_id);
  };

  const onProductAction = (p: Product, action: 'add_role' | 'deactivate' | 'restore' | 'remove', productGroupID: string) => {
    if (action === 'add_role') {
      setRoleModalProduct(p);
      setRoleModalOpen(true);
      return;
    }
    if (action === 'deactivate') {
      if (window.confirm(`Deactivate product "${p.product_name}"?`)) {
        statusMutation.mutate({ productId: p.product_id, status: 'Inactive' });
      }
      return;
    }
    if (action === 'restore') {
      statusMutation.mutate({ productId: p.product_id, status: 'Active' });
    }

    if (action === 'remove') {
      if (window.confirm(`Remove "${p.product_name} from this product group?`)){
        removeFromGroupMutation.mutate({productId: p.product_id, productGroupID: productGroupID});
      }
    }
  };

  const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString() : '—');
  const onAddProduct = (group: ProductGroup) => openAddModal(group);

  if (isPending) return <p>Loading products...</p>;
  if (isError)   return <p>Error: {error.message}</p>;

  const TOTAL_COLS = 5; // chevron + name + status + last update + actions
  const existingGroupNames = productGroups.map(g => g.product_group_name || '');

  return (
    <>
      {/* Top-right Add Group button */}
      <div className="d-flex justify-content-end mb-3">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setAddGroupOpen(true)}
        >
          <i className='fa fa-plus me-2'/>
          Add Group
        </button>
      </div>

      <StyledTable>
        <thead>
          <tr>
            <th style={{ width: 40 }}></th>
            <th>Name</th>
            <th>Status</th>
            <th className="d-none d-lg-table-cell">Last Update</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {productGroups.map((group) => {
            const open = !!openGroups[group.product_group_id];
            const products: Product[] = Array.isArray(group.products) ? group.products : [];

            return (
              <React.Fragment key={group.product_group_id}>
                {/* Group row */}
                <tr>
                  {/* Chevron */}
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

                  {/* Name; when open, span remaining columns + right-aligned buttons */}
                  <td colSpan={open ? (TOTAL_COLS - 1) : 1}>
                    <div className="d-flex align-items-center">
                      <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); toggleOpen(group.product_group_id); }}
                        className="text-decoration-none"
                      >
                        {group.product_group_name}
                      </a>

                      {open && (
                        <div className="ms-auto d-flex gap-2">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={(e) => { e.stopPropagation(); onAddProduct(group); }}
                            aria-label={`Add product to ${group.product_group_name}`}
                          >
                            <i className='fa fa-plus me-2'/>
                            Add Product
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={(e) => { e.stopPropagation(); onDeleteGroup(group); }}
                            aria-label={`Delete ${group.product_group_name}`}
                            disabled={deleteGroupMutation.isPending}
                          >
                            <i className='fa fa-trash me-2'/>
                            Delete Group
                          </button>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Hide these when open */}
                  {!open && (
                    <>
                      <td>
                        <StatusCell status={group.status} />
                      </td>
                      <td className="d-none d-lg-table-cell">
                        {group.status === 'Inactive' ? 'Deactivated on: ' : ''}
                        {fmtDate(group.last_update)}
                      </td>
                      <td className="td-actions text-end">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => onDeleteGroup(group)}
                          disabled={deleteGroupMutation.isPending}
                          title="Delete group"
                        >
                          🗑️
                        </button>
                      </td>
                    </>
                  )}
                </tr>

                {/* Expanded products row */}
                {open && (
                  <tr>
                    <td colSpan={TOTAL_COLS} className="bg-light">
                      {products.length === 0 ? (
                        <div className="text-muted py-2 px-2">No products in this group.</div>
                      ) : (
                        <div className="p-2 table-responsive">
                          <table className="table table-sm mb-0" style={{ tableLayout: 'fixed', width: '100%' }}>
                            <colgroup>
                              <col style={{ width: '40%' }} />
                              <col style={{ width: '17%' }} />
                              <col style={{ width: '13%' }} />
                              <col style={{ width: '15%' }} />
                              <col style={{ width: '15%' }} />
                            </colgroup>
                            <thead>
                              <tr>
                                <th>Product</th>
                                <th>Roles</th>
                                <th>Status</th>
                                <th className="d-none d-lg-table-cell">Last Update</th>
                                <th className="th-actions text-center">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dedupeProductsInGroup(products).map((p) => (
                                <tr key={p.product_id}>
                                  <td className="text-truncate" title={p.product_name}>{p.product_name}</td>
                                  <td>
                                    <RoleBadges
                                      roles={p.roles}
                                      maxVisible={3}
                                      onRemove={(roleId) => {
                                        if (!window.confirm('Remove this role from the product?')) return;
                                        removeRoleMutation.mutate({ productId: p.product_id, roleId });
                                      }}
                                    />
                                  </td>
                                  <td><StatusCell status={p.status as string | undefined} /></td>
                                  <td className="d-none d-lg-table-cell text-truncate" title={p.last_update || ''}>
                                    {p.last_update ? new Date(p.last_update).toLocaleString() : '—'}
                                  </td>
                                  <td className="text-center" style={{ minWidth: 48 }}>
                                    <ProductActionsMenu
                                      productId={p.product_id}
                                      productStatus={(p.status as any) ?? undefined}
                                      productGroupId={group.product_group_id}
                                      onAction={(action) => onProductAction(p, action, group.product_group_id)}
                                    />
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

      {/* Add Role modal */}
      <AddRoleModal
        isOpen={roleModalOpen}
        onClose={() => { setRoleModalOpen(false); setRoleModalProduct(null); }}
        productName={roleModalProduct?.product_name ?? ''}
        assignedRoles={roleModalProduct?.roles}
        isSubmitting={addRoleMutation.isPending}
        onSubmit={(roleId) => {
          if (!roleModalProduct) return;
          addRoleMutation.mutate({ productId: roleModalProduct.product_id, roleId });
        }}
      />

      {/* Add Product modal */}
      <AddProductModal
        isOpen={addModalOpen}
        onClose={closeAddModal}
        productGroup={addModalGroup}
        onSaved={afterSaved}
      />

      {/* Add Group modal */}
      <AddGroupModal
        isOpen={addGroupOpen}
        onClose={() => setAddGroupOpen(false)}
        existingNames={existingGroupNames}
        onSaved={afterSaved}
      />
    </>
  );
};

export default ProductTable;
