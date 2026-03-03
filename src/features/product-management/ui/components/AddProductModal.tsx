import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Button, FormGroup, Label, Input, Spinner
} from 'reactstrap';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import AsyncSelect from 'react-select/async';

import { addProduct, fetchProducts, mapProductToProductGroup, addSigmaProduct } from '../../../../shared/services/products';
import { fetchRoles } from '../../../../shared/services/roles';
import { fetchDashboards } from '../../../../shared/services/dashboards';

import type { Product } from '../../../../entities/Products';
import type { ProductGroup } from '../../../../entities/ProductGroup';
import './AddProductDrawer.css';
import './ProductTable.css';

type Role = { role_id: string; role_name: string };
type SigmaDashboard = { workbookId: string | number; name: string };
type Option = { value: string; label: string };

function roleBadgeClass(roleName?: string) {
  const normalized = (roleName ?? "").trim().toLowerCase();
  switch (normalized) {
    case "admin":
      return "badge qf-pm-role-badge qf-pm-role-badge-admin";
    case "owner":
      return "badge qf-pm-role-badge qf-pm-role-badge-owner";
    case "user":
      return "badge qf-pm-role-badge qf-pm-role-badge-user";
    case "viewer":
    case "read-only":
      return "badge qf-pm-role-badge qf-pm-role-badge-viewer";
    default:
      return "badge qf-pm-role-badge qf-pm-role-badge-default";
  }
}

function useAllProducts(enabled: boolean) {
  return useQuery({
    queryKey: ['allProducts'],
    queryFn: async () => {
      const res = await fetchProducts('All', 1000, '', '');
      const products = Array.isArray(res) ? res : res?.products ?? [];
      return products as Product[];
    },
    enabled,
    refetchOnMount: 'always',
    staleTime: 30_000,
  });
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  productGroup: ProductGroup | null;
  onSaved?: () => void;
  envOverride?: string;
};

type Mode = 'create' | 'existing' | 'sigma';

const AddProductModal: React.FC<Props> = ({ isOpen, onClose, productGroup, onSaved, envOverride }) => {
  // ───────────────────────────── state
  const [mode, setMode] = useState<Mode>('create');

  // Create mode
  const [productName, setProductName] = useState('');
  const [nameError, setNameError] = useState<string>('');

  // Existing mode
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedProductName, setSelectedProductName] = useState<string>('');
  const [existingError, setExistingError] = useState<string>('');

  // Sigma mode
const resolvedEnv = String(
  envOverride ??
  import.meta.env.VITE_APP_ENV ??
  import.meta.env.MODE ??
  "dev"
).toLowerCase();

  const [selectedSigmaId, setSelectedSigmaId] = useState<string>('');
  const [selectedSigmaName, setSelectedSigmaName] = useState<string>('');

  // Roles (shared)
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [roleToAdd, setRoleToAdd] = useState<string>('');

  // ───────────────────────────── data
  const { data: roles = [], isLoading: rolesLoading, isError: rolesError } = useQuery<Role[], Error>({
    queryKey: ['roles'],
    queryFn: fetchRoles,
    staleTime: 60_000,
    enabled: isOpen,
  });

  const {
    data: allProducts = [],
    isLoading: productsLoading,
    isError: productsError,
    refetch: refetchProducts,
  } = useAllProducts(isOpen);

  const {
    data: sigmaDashboards = [],
    isLoading: sigmaLoading,
    isError: sigmaError,
    refetch: refetchSigma,
  } = useQuery<SigmaDashboard[], Error>({
    queryKey: ['sigmaDashboards', resolvedEnv],
    queryFn: () => fetchDashboards(),
    enabled: isOpen && mode === 'sigma',
    staleTime: 60_000,
    select: (raw: any) => (Array.isArray(raw) ? raw : (raw?.dashboards ?? [])),
  });

  // Products already in this group (avoid duplicate attach)
  const existingInGroupIds = useMemo(
    () => new Set((productGroup?.products ?? []).map(p => String(p.product_id))),
    [productGroup]
  );

  const selectableProducts = useMemo(
    () => allProducts.filter(p => !existingInGroupIds.has(String(p.product_id))),
    [allProducts, existingInGroupIds]
  );

  // ───────────────────────────── effects
  // Prefill roles when picking an existing product
  useEffect(() => {
    if (mode !== 'existing') return;
    if (!selectedProductId) {
      setSelectedRoleIds([]);
      return;
    }
    const found = allProducts.find(p => String(p.product_id) === String(selectedProductId));
    if (!found) {
      setSelectedRoleIds([]);
      return;
    }
    const fromProduct = (found.roles ?? [])
      .map(pr => pr.role?.role_id)
      .filter(Boolean) as string[];
    setSelectedRoleIds(fromProduct);
  }, [mode, selectedProductId, allProducts]);

  // Keep lists fresh when switching modes
  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'existing') refetchProducts();
    if (mode === 'sigma') refetchSigma();
  }, [mode, isOpen, refetchProducts, refetchSigma]);

  // Reset when modal opens or group changes
  useEffect(() => {
    if (!isOpen) return;
    setMode('create');
    setProductName('');
    setNameError('');
    setSelectedProductId('');
    setSelectedProductName('');
    setExistingError('');
    setSelectedRoleIds([]);
    setRoleToAdd('');
    setSelectedSigmaId('');
    setSelectedSigmaName('');
  }, [isOpen, productGroup?.product_group_id]);

  // ───────────────────────────── role handlers
  const onAddRole = () => {
    if (!roleToAdd) return;
    if (!selectedRoleIds.includes(roleToAdd)) {
      setSelectedRoleIds(prev => [...prev, roleToAdd]);
    }
    setRoleToAdd('');
  };
  const onRemoveRole = (rid: string) => {
    setSelectedRoleIds(prev => prev.filter(id => id !== rid));
  };
  const selectedRoleObjects = useMemo(
    () => roles.filter(r => selectedRoleIds.includes(r.role_id)),
    [roles, selectedRoleIds]
  );

  // ───────────────────────────── AsyncSelect helpers
  // Products (Existing)
  const toProductOption = (p: Product): Option => ({
    value: String(p.product_id),
    label: p.product_name,
  });
  const loadProductOptions = async (input: string): Promise<Option[]> => {
    const q = (input || '').trim().toLowerCase();
    const pool = selectableProducts || [];
    const list = q
      ? pool.filter(p => (p.product_name || '').toLowerCase().includes(q))
      : pool;
    return list.slice(0, 100).map(toProductOption);
  };
  const currentProductValue: Option | null = selectedProductId
    ? { value: String(selectedProductId), label: selectedProductName || (selectableProducts.find(p => String(p.product_id) === String(selectedProductId))?.product_name ?? '') }
    : null;

  // Sigma
  const toSigmaOption = (d: SigmaDashboard): Option => ({ value: String(d.workbookId), label: d.name });
  const loadSigmaOptions = async (input: string): Promise<Option[]> => {
    const q = (input || '').trim().toLowerCase();
    const pool = sigmaDashboards || [];
    const list = q ? pool.filter(d => (d.name || '').toLowerCase().includes(q)) : pool;
    return list.slice(0, 50).map(toSigmaOption);
  };
  const currentSigmaValue: Option | null = selectedSigmaId
    ? { value: String(selectedSigmaId), label: selectedSigmaName || (sigmaDashboards.find(d => String(d.workbookId) === String(selectedSigmaId))?.name ?? '') }
    : null;

  // ───────────────────────────── validation + mutation
  const validate = (): string | null => {
    if (!productGroup) return 'No product group selected.';
    if (selectedRoleIds.length === 0) return 'Please select at least one role.';

    if (mode === 'create' && !productName.trim()) return 'Product name is required.';
    if (mode === 'existing' && !selectedProductId) return 'Please select a product.';
    if (mode === 'sigma' && !selectedSigmaId) return 'Please select a Sigma dashboard.';
    return null;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const err = validate();
      if (err) throw new Error(err);
      if (!productGroup) throw new Error('No product group selected.');

      if (mode === 'create') {
        return addProduct({
          product_group_id: productGroup.product_group_id,
          product_name: productName.trim(),
          role_ids: selectedRoleIds,
        });
      }

      if (mode === 'existing') {
        return mapProductToProductGroup(selectedProductId, productGroup.product_group_id);
      }

      // mode === 'sigma'
      return addSigmaProduct({
        type: 'sigma',
        product_group_id: productGroup.product_group_id,
        product_name: selectedSigmaName || 'Sigma Dashboard',
        sigma_dashboard_id: selectedSigmaId,
        role_ids: selectedRoleIds,
      });
    },
    onSuccess: (resp: any) => {
      const status = resp?.status ?? 'ok';
      if (status === 'partial') {
        toast.warn(resp?.message ?? 'Product created, but Sigma configuration partially failed.');
      } else {
        toast.success(
          mode === 'create'
            ? 'Product created'
            : mode === 'existing'
            ? 'Product added to group'
            : 'Sigma product created'
        );
      }
      onClose();
      onSaved?.();
    },
    onError: (e: any) => {
      const msg = e?.message || e?.response?.data?.message || 'Failed to save product';
      toast.error(msg);
    },
  });

  const handleSave = () => {
    setNameError('');
    setExistingError('');
    const err = validate();
    if (err) {
      if (mode === 'create' && err.toLowerCase().includes('name')) setNameError(err);
      if (mode === 'existing' && err.toLowerCase().includes('product')) setExistingError(err);
      toast.error(err);
      return;
    }
    mutation.mutate();
  };

  const canSave =
    selectedRoleIds.length > 0 &&
    (mode === 'create'
      ? productName.trim().length > 0
      : mode === 'existing'
      ? !!selectedProductId
      : !!selectedSigmaId);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // ───────────────────────────── render
  return createPortal(
    <>
      <div className="offcanvas-backdrop fade show" onClick={onClose} />
      <div
        className="offcanvas offcanvas-end show product-mgmt-offcanvas"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={productGroup ? productGroup.product_group_name : 'Add Product'}
      >
      <div className="offcanvas-header border-bottom">
        <h5 className="offcanvas-title mb-0">
          {productGroup ? productGroup.product_group_name : 'Add Product'}
        </h5>
        <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
      </div>

      <div className="offcanvas-body">
        {/* Mode toggle */}
        <FormGroup tag="fieldset" className="mb-3">
          <legend className="col-form-label pt-0">Add product by</legend>

          <FormGroup check inline>
            <Input
              id="mode-create"
              name="mode"
              type="radio"
              checked={mode === 'create'}
              onChange={() => setMode('create')}
            />
            <Label for="mode-create" check>Create new</Label>
          </FormGroup>

          <FormGroup check inline className="ms-3">
            <Input
              id="mode-existing"
              name="mode"
              type="radio"
              checked={mode === 'existing'}
              onChange={() => setMode('existing')}
            />
            <Label for="mode-existing" check>Use existing</Label>
          </FormGroup>

          <FormGroup check inline className="ms-3">
            <Input
              id="mode-sigma"
              name="mode"
              type="radio"
              checked={mode === 'sigma'}
              onChange={() => setMode('sigma')}
            />
            <Label for="mode-sigma" check>Add Sigma dashboard</Label>
          </FormGroup>
        </FormGroup>

        {/* Create new product */}
        {mode === 'create' && (
          <FormGroup>
            <Label htmlFor="prodName">Product Name</Label>
            <Input
              id="prodName"
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              invalid={!!nameError}
              placeholder="Enter product name"
            />
            {nameError && <small className="text-danger">{nameError}</small>}
          </FormGroup>
        )}

        {/* Use existing product (AsyncSelect) */}
        {mode === 'existing' && (
          <FormGroup>
            <Label>Select Product</Label>
            {productsLoading ? (
              <div className="d-flex align-items-center gap-2">
                <Spinner size="sm" /> Loading products…
              </div>
            ) : productsError ? (
              <div className="text-danger">Failed to load products.</div>
            ) : (
              <>
                <AsyncSelect
                  cacheOptions
                  defaultOptions={selectableProducts.slice(0, 100).map(toProductOption)}
                  loadOptions={loadProductOptions}
                  value={currentProductValue}
                  onChange={(opt: Option | null) => {
                    if (!opt) {
                      setSelectedProductId('');
                      setSelectedProductName('');
                    } else {
                      setSelectedProductId(String(opt.value));
                      setSelectedProductName(opt.label);
                    }
                  }}
                  getOptionValue={(o) => String(o.value)}
                  getOptionLabel={(o) => o.label}
                  placeholder="Type to search products…"
                  isClearable
                  menuPortalTarget={document.body}
                  styles={{
                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                  }}
                />
                {existingError && <small className="text-danger">{existingError}</small>}
                {!!selectedProductId && (
                  <small className="text-muted d-block mt-1">
                    Roles below are prefilled from the selected product. You can add/remove before saving.
                  </small>
                )}
              </>
            )}
          </FormGroup>
        )}

        {/* Sigma dashboard selection (AsyncSelect) */}
        {mode === 'sigma' && (
          <div className="mb-2">
            <Label className="fw-bold">Sigma Dashboard ({resolvedEnv})</Label>

            {sigmaLoading ? (
              <div className="d-flex align-items-center gap-2">
                <Spinner size="sm" /> Loading dashboards…
              </div>
            ) : sigmaError ? (
              <div className="d-flex align-items-center gap-2">
                <span className="text-danger">Failed to load dashboards.</span>
                <Button size="sm" color="secondary" onClick={() => refetchSigma()}>
                  Retry
                </Button>
              </div>
            ) : (
              <AsyncSelect
                cacheOptions
                defaultOptions={sigmaDashboards.slice(0, 50).map(toSigmaOption)}
                loadOptions={loadSigmaOptions}
                value={currentSigmaValue}
                onChange={(opt: Option | null) => {
                  if (!opt) {
                    setSelectedSigmaId('');
                    setSelectedSigmaName('');
                  } else {
                    setSelectedSigmaId(String(opt.value));
                    setSelectedSigmaName(opt.label);
                  }
                }}
                getOptionValue={(o) => String(o.value)}
                getOptionLabel={(o) => o.label}
                placeholder="Type to search dashboards…"
                isClearable
                menuPortalTarget={document.body}
                styles={{
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                }}
              />
            )}

            <small className="text-muted">
              Only dashboards from the {resolvedEnv.toUpperCase()} Sigma workspace are shown.
            </small>
          </div>
        )}

        {/* Roles picker (all modes) */}
        <div className="mt-4">
          <Label>Add Roles</Label>
          {rolesLoading ? (
            <div className="d-flex align-items-center gap-2"><Spinner size="sm" /> Loading roles…</div>
          ) : rolesError ? (
            <div className="text-danger">Failed to load roles.</div>
          ) : (
            <>
              <div className="d-flex gap-2 align-items-center mb-2">
                <Input
                  type="select"
                  value={roleToAdd}
                  onChange={(e) => setRoleToAdd(e.target.value)}
                  style={{ maxWidth: 320 }}
                >
                  <option value="">Select a role…</option>
                  {roles.map(r => (
                    <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                  ))}
                </Input>
                <Button color="secondary" onClick={onAddRole} disabled={!roleToAdd}>
                  Add
                </Button>
              </div>

              {selectedRoleObjects.length > 0 ? (
                <div className="d-flex flex-wrap gap-2">
                  {selectedRoleObjects.map(r => (
                    <span key={r.role_id} className={roleBadgeClass(r.role_name)}>
                      {r.role_name}
                      <button
                        type="button"
                        className="btn-close btn-close-white btn-sm ms-2"
                        aria-label={`Remove ${r.role_name}`}
                        onClick={() => onRemoveRole(r.role_id)}
                        style={{ transform: 'scale(0.8)' }}
                      />
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-muted">No roles selected.</div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="border-top p-3 d-flex justify-content-end gap-2">
        <Button color="secondary" onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button color="primary" onClick={handleSave} disabled={mutation.isPending || !canSave}>
          {mutation.isPending
            ? 'Saving…'
            : mode === 'create'
            ? 'Create Product'
            : mode === 'existing'
            ? 'Add to Group'
            : 'Add Sigma Product'}
        </Button>
      </div>
      </div>
    </>,
    document.body
  );
};

export default AddProductModal;
