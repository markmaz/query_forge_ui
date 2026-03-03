import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, ModalHeader, ModalBody, ModalFooter,
  Button, FormGroup, Label, Input, Spinner
} from 'reactstrap';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';

import WorkspaceTable from '../../../workspaces/ui/WorkspaceTable';
import type { WorkspaceSelection } from '../../../workspaces/ui/WorkspaceTable';

import { inviteUsersBulk } from '../../../../shared/services/users';

// ⬇️ NEW: use groups instead of flat products
import { fetchProductGroups } from '../../../../shared/services/productGroup';
import type { Product } from '../../../../entities/Products';
import type { ProductGroup } from '../../../../entities/ProductGroup';
import './ImportUsersModal.css'
import '../UserManagementTheme.css';
import { useAppSelector } from '../../../../shared/lib/hooks';

// ⬇️ NEW: shared grouped selector
import ProductRoleSelectorByGroup, {
  mergeAllProductsFromGroups
} from '../../../product-management/ui/components/ProductRoleSelector';

// ---------- helpers ----------

// Simple email validator
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Parse a CSV that’s a single column of emails (header optional)
async function parseEmailCsv(file: File): Promise<{ valid: string[]; invalid: string[] }> {
  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { valid: [], invalid: [] };

  // If the first line looks like a header (contains “email”), skip it
  const hasHeader = /email/i.test(lines[0]) && !isEmail(lines[0]);

  const emails: string[] = [];
  for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
    // Take the first column if comma present
    const firstCell = lines[i].split(',')[0].trim();
    if (firstCell) emails.push(firstCell);
  }

  // normalize + dedupe
  const norm = Array.from(new Set(emails.map(e => e.toLowerCase())));
  const valid: string[] = [];
  const invalid: string[] = [];
  norm.forEach(e => (isEmail(e) ? valid.push(e) : invalid.push(e)));

  return { valid, invalid };
}

// Badge color helper (for summary)
function roleBadgeClass(roleName?: string) {
  const n = (roleName || '').trim().toLowerCase();
  switch (n) {
    case 'admin': return 'badge qf-um-role-badge qf-um-role-badge-admin';
    case 'owner': return 'badge qf-um-role-badge qf-um-role-badge-owner';
    case 'user': return 'badge qf-um-role-badge qf-um-role-badge-user';
    case 'viewer':
    case 'read-only': return 'badge qf-um-role-badge qf-um-role-badge-viewer';
    default: return 'badge qf-um-role-badge qf-um-role-badge-default';
  }
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onFinished?: () => void;

  // forward-to-Modal options
  size?: 'sm' | 'lg' | 'xl';
  className?: string;     // applied to the modal dialog
  scrollable?: boolean;   // makes body scroll while header/footer stick
}

// 🚀 Add Results step (4)
type Step = 0 | 1 | 2 | 3 | 4; // 0 Upload, 1 Roles, 2 Workspaces, 3 Summary, 4 Results

// shape returned by your bulk invite endpoint
type InviteBulkResult = {
  total_user_count: number;
  invites_sent: number;
  users_skipped: number;
  skipped_emails: string[];
};

const InviteUsersWizardModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onFinished,
  size = 'xl',
  className = '',
  scrollable = true,
}) => {
  const [step, setStep] = useState<Step>(0);

  // Step 1: emails
  const [fileError, setFileError] = useState<string>('');
  const [validEmails, setValidEmails] = useState<string[]>([]);
  const [invalidEmails, setInvalidEmails] = useState<string[]>([]);

  // Step 2: selected roles (product_id -> product_role_id | "None")
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});

  // Step 3: workspaces
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<WorkspaceSelection[]>([]);
  const [wsError, setWsError] = useState('');

  // Step 4: results
  const [inviteResult, setInviteResult] = useState<InviteBulkResult | null>(null);

  // Show workspace names/servers in summary
  const workspaceCatalog = useAppSelector(s => s.workspaces.workspaces) ?? [];
  const wsById = useMemo(() => {
    const m = new Map<string, { workspace_id: string; name: string; server?: string }>();
    workspaceCatalog.forEach(ws => m.set(String(ws.workspace_id), ws));
    return m;
  }, [workspaceCatalog]);

  const selectedWorkspaceDetails = useMemo(
    () =>
      selectedWorkspaces.map(sel => {
        const w = wsById.get(String(sel.workspace_id));
        return {
          id: String(sel.workspace_id),
          name: w?.name ?? String(sel.workspace_id),
          server: w?.server,
          is_default: !!sel.is_default,
        };
      }),
    [selectedWorkspaces, wsById]
  );

  // Fetch product groups for the role selector
  const {
    data: groups = [],
    isLoading: groupsLoading,
    isError: groupsError
  } = useQuery<ProductGroup[], Error>({
    queryKey: ['productGroups', 'All'],
    queryFn: () => fetchProductGroups('All'),
    enabled: isOpen,
    initialData: [],
    placeholderData: (prev) => prev ?? [],
    select: (raw) => Array.isArray(raw) ? raw : [],
    staleTime: 60_000,
  });

  // consolidated products for the summary
  const allProducts: Product[] = useMemo(
    () => mergeAllProductsFromGroups(groups),
    [groups]
  );

  // Reset state whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setFileError('');
    setValidEmails([]);
    setInvalidEmails([]);
    setSelectedRoles({});
    setSelectedWorkspaces([]);
    setWsError('');
    setInviteResult(null);
  }, [isOpen]);

  // Bulk invite mutation — on success go to Results (step 4) with server response
  const inviteMutation = useMutation<InviteBulkResult, any, void>({
    mutationFn: async () => {
      const productSelections = Object.entries(selectedRoles)
        .filter(([_, prid]) => prid && prid !== 'None')
        .map(([product_id, product_role_id]) => ({ product_id, product_role_id }));

      if (validEmails.length === 0) throw new Error('No valid emails to invite.');
      if (productSelections.length === 0) throw new Error('Select at least one product role.');
      if (selectedWorkspaces.length === 0) throw new Error('Select at least one workspace.');

      return inviteUsersBulk({
        emails: validEmails,
        products: productSelections,
        workspaces: selectedWorkspaces,
      }) as Promise<InviteBulkResult>;
    },
    onSuccess: (data) => {
      setInviteResult(data);
      setStep(4); // 🚀 show Results
      // optional: toast.success('Invites submitted. See results below.');
    },
    onError: (e: any) => {
      toast.error(e?.message ?? 'Failed to send invites');
    },
  });

  // ——— Step validators ———
  const canNext = useMemo(() => {
    if (step === 0) return validEmails.length > 0;
    if (step === 1) return Object.values(selectedRoles).some(v => v && v !== 'None');
    if (step === 2) return selectedWorkspaces.length > 0;
    return true; // steps 3 & 4: handled by Finish/Close
  }, [step, validEmails, selectedRoles, selectedWorkspaces]);

  // ——— Handlers ———
  const handleFile = async (file?: File | null) => {
    setFileError('');
    if (!file) return;

    try {
      const { valid, invalid } = await parseEmailCsv(file);
      setValidEmails(valid);
      setInvalidEmails(invalid);

      if (valid.length === 0) {
        setFileError('No valid email addresses found in the file.');
        return;
      }

      // Auto-advance to roles on success
      setStep(1);
      toast.success(`Loaded ${valid.length} emails${invalid.length ? ` (${invalid.length} invalid)` : ''}.`);
    } catch (e: any) {
      setFileError(e?.message ?? 'Failed to read file. Please try CSV with one email per line.');
    }
  };

  // ——— Render helpers ———
  const renderStepHeader = () => {
    const steps = [
      { label: 'Upload' },
      { label: 'Roles' },
      { label: 'Workspaces' },
      { label: 'Summary' },
      { label: 'Results' }, // NEW
    ];

    const statusFor = (idx: number) =>
      step === (idx as Step) ? 'active' : step > (idx as Step) ? 'complete' : 'todo';

    return (
      <div className="chev-stepper mb-4">
        {steps.map((s, i) => {
          const st = statusFor(i);
          const cls = [
            'chev-step',
            st,
            i === 0 ? 'first' : '',
            i === steps.length - 1 ? 'last' : '',
          ].join(' ');
          // earlier steps on top of later steps
          const z = steps.length - i;
          return (
            <div key={s.label} className={cls} style={{ zIndex: z }}>
              <div className="chev-tile">
                <span className="chev-label">{s.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderUpload = () => (
    <>
      <FormGroup>
        <Label>Upload CSV of email addresses</Label>
        <Input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <small className="text-muted">
          CSV should contain a single column of email addresses. A header row like <code>email</code> is OK.
        </small>
      </FormGroup>

      {(validEmails.length > 0 || invalidEmails.length > 0) && (
        <div className="mt-3">
          <div><strong>Valid emails:</strong> {validEmails.length}</div>
          {validEmails.length > 0 && (
            <div className="text-muted">
              {validEmails.slice(0, 5).join(', ')}{validEmails.length > 5 ? '…' : ''}
            </div>
          )}
          <div className="mt-2"><strong>Invalid rows:</strong> {invalidEmails.length}</div>
          {invalidEmails.length > 0 && (
            <div className="text-danger">
              {invalidEmails.slice(0, 5).join(', ')}{invalidEmails.length > 5 ? '…' : ''}
            </div>
          )}
        </div>
      )}

      {fileError && <div className="alert alert-danger mt-3">{fileError}</div>}
    </>
  );

  // Roles step uses shared grouped selector
  const renderRoles = () => (
    <>
      {groupsLoading && (
        <div className="d-flex align-items-center gap-2">
          <Spinner size="sm" /> Loading products…
        </div>
      )}
      {groupsError && <div className="text-danger">Failed to load product catalog.</div>}
      {!groupsLoading && !groupsError && (
        <ProductRoleSelectorByGroup
          groups={groups}
          value={selectedRoles}
          onChange={setSelectedRoles}
          onInfo={(msg) => toast.info(msg)}
        />
      )}

      <div className="mt-2 text-muted">
        Choose at least one product role. The selected roles will be applied to <strong>all</strong> uploaded emails.
      </div>
    </>
  );

  const renderWorkspaces = () => (
    <>
      <Label>Select workspace(s)</Label>
      <WorkspaceTable
        selected={selectedWorkspaces}
        onSelectionChange={(ids) => {
          setWsError('');
          setSelectedWorkspaces(ids);
        }}
      />
      {wsError && <div className="text-danger mt-2">{wsError}</div>}
      <div className="mt-2 text-muted">Pick at least one workspace.</div>
    </>
  );

  const renderSummary = () => {
    const chosen = Object.entries(selectedRoles)
      .filter(([_, prid]) => prid && prid !== 'None')
      .map(([product_id, product_role_id]) => {
        const p = allProducts.find(pp => pp.product_id === product_id);
        const roleName =
          (p?.roles ?? []).find(r => String(r.product_role_id) === String(product_role_id))?.role?.role_name ?? '—';
        return { productName: p?.product_name ?? product_id, roleName };
      });

    return (
      <>
        <div className="mb-3">
          <strong>Invitations:</strong> {validEmails.length} user{validEmails.length === 1 ? '' : 's'}
          {invalidEmails.length > 0 && (
            <span className="text-muted ms-2">({invalidEmails.length} invalid will be ignored)</span>
          )}
        </div>

        <div className="mb-3">
          <strong>Roles applied to all users:</strong>
          {chosen.length === 0 ? (
            <div className="text-muted mt-1">No roles selected.</div>
          ) : (
            <ul className="mt-1 mb-0">
              {chosen.map((c, i) => (
                <li key={i}>
                  <span className="me-2">{c.productName}</span>
                  <span className={roleBadgeClass(c.roleName)}>{c.roleName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mb-2">
          <strong>Workspaces:</strong>
          {selectedWorkspaceDetails.length === 0 ? (
            <span className="text-muted ms-2">None selected</span>
          ) : (
            <ul className="mt-2 mb-0">
              {selectedWorkspaceDetails.map(ws => (
                <li key={ws.id}>
                  <span className="me-2">{ws.name}</span>
                  {ws.server && <span className="text-muted">({ws.server})</span>}
                  {ws.is_default && <span className="badge qf-um-role-badge qf-um-role-badge-default ms-2">default</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="text-muted">
          On finish, invitations will be sent and you will receive an email summary (successes & failures).
        </div>
      </>
    );
  };

  // NEW: Results renderer
  const renderResults = () => {
    if (!inviteResult) return <div className="text-muted">No result available.</div>;

    const { total_user_count, invites_sent, users_skipped, skipped_emails } = inviteResult;
    const allGood = invites_sent === total_user_count && users_skipped === 0;

    return (
      <>
        <div className="alert qf-um-results-card">
          <div className="fw-bold mb-1">Bulk Invite Results</div>
          <div>Total in file: <strong>{total_user_count}</strong></div>
          <div>Invites sent: <strong>{invites_sent}</strong></div>
          <div>Users skipped: <strong>{users_skipped}</strong></div>
        </div>

        {skipped_emails?.length > 0 && (
          <div className="mt-3">
            <div className="fw-bold mb-2">Skipped emails</div>
            <ul className="mb-0">
              {skipped_emails.map((e) => (
                <li key={e} className="text-muted">{e}</li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  };

  // Footer buttons
  const onNext = () => {
    if (step === 2 && selectedWorkspaces.length === 0) {
      setWsError('Please select at least one workspace.');
      return;
    }
    if (step < 3) setStep((s) => (s + 1) as Step);
  };
  const onBack = () => setStep((s) => (s > 0 ? (s - 1) as Step : s));

  const nextLabel = step === 3 ? (inviteMutation.isPending ? 'Submitting…' : 'Finish') : 'Next';

  return (
    <Modal
      isOpen={isOpen}
      toggle={onClose}
      size={size}
      className={`modal-tall ${className}`}
      scrollable={scrollable}
    >
      <ModalHeader toggle={onClose}>Invite Users</ModalHeader>
      <ModalBody className='px-4'>
        {renderStepHeader()}
        {step === 0 && renderUpload()}
        {step === 1 && renderRoles()}
        {step === 2 && renderWorkspaces()}
        {step === 3 && renderSummary()}
        {step === 4 && renderResults()}{/* NEW */}
      </ModalBody>

      {/* Footer: on Results step, show Close only; otherwise show wizard controls */}
      <ModalFooter className="w-100 d-flex">
        {step === 4 ? (
          <div className="ms-auto">
            <Button
              color="primary"
              onClick={() => {
                onFinished?.();
                onClose();
              }}
            >
              Close
            </Button>
          </div>
        ) : (
          <>
            <div className="me-auto">
              <Button color="secondary" onClick={onClose} disabled={inviteMutation.isPending}>
                Cancel
              </Button>
            </div>
            <div>
              <Button color="light" className="me-2" onClick={onBack} disabled={step === 0 || inviteMutation.isPending}>
                Back
              </Button>
              {step < 3 ? (
                <Button color="primary" onClick={onNext} disabled={!canNext}>
                  {nextLabel}
                </Button>
              ) : (
                <Button
                  color="primary"
                  onClick={() => inviteMutation.mutate()}
                  disabled={inviteMutation.isPending || !canNext}
                >
                  {nextLabel}
                </Button>
              )}
            </div>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
};

export default InviteUsersWizardModal;
