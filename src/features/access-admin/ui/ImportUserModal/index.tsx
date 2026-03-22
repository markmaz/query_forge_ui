import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, ModalHeader, ModalBody, ModalFooter,
  Button, FormGroup, Label, Input
} from 'reactstrap';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';

import WorkspaceTable from '../../../tenant-admin/ui/WorkspaceTable';
import type { WorkspaceSelection } from '../../../tenant-admin/ui/WorkspaceTable';

import { inviteUsersBulk } from '../../../../shared/services/users';
import './ImportUsersModal.css';
import '../UserManagementTheme.css';
import { useAppSelector } from '../../../../shared/runtime/hooks';

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

async function parseEmailCsv(file: File): Promise<{ valid: string[]; invalid: string[] }> {
  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return { valid: [], invalid: [] };

  const hasHeader = /email/i.test(lines[0]) && !isEmail(lines[0]);
  const emails: string[] = [];

  for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
    const firstCell = lines[i].split(',')[0].trim();
    if (firstCell) emails.push(firstCell);
  }

  const normalized = Array.from(new Set(emails.map((email) => email.toLowerCase())));
  const valid: string[] = [];
  const invalid: string[] = [];

  normalized.forEach((email) => {
    if (isEmail(email)) valid.push(email);
    else invalid.push(email);
  });

  return { valid, invalid };
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onFinished?: () => void;
  size?: 'sm' | 'lg' | 'xl';
  className?: string;
  scrollable?: boolean;
};

type Step = 0 | 1 | 2 | 3;

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
  const [fileError, setFileError] = useState('');
  const [validEmails, setValidEmails] = useState<string[]>([]);
  const [invalidEmails, setInvalidEmails] = useState<string[]>([]);
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<WorkspaceSelection[]>([]);
  const [wsError, setWsError] = useState('');
  const [inviteResult, setInviteResult] = useState<InviteBulkResult | null>(null);

  const workspaceCatalog = useAppSelector((state) => state.workspaces.workspaces) ?? [];
  const wsById = useMemo(() => {
    const entries = new Map<string, { workspace_id: string; name: string; server?: string }>();
    workspaceCatalog.forEach((workspace) => entries.set(String(workspace.workspace_id), workspace));
    return entries;
  }, [workspaceCatalog]);

  const selectedWorkspaceDetails = useMemo(
    () =>
      selectedWorkspaces.map((selection) => {
        const workspace = wsById.get(String(selection.workspace_id));
        return {
          id: String(selection.workspace_id),
          name: workspace?.name ?? String(selection.workspace_id),
          server: workspace?.server,
          is_default: !!selection.is_default,
        };
      }),
    [selectedWorkspaces, wsById]
  );

  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setFileError('');
    setValidEmails([]);
    setInvalidEmails([]);
    setSelectedWorkspaces([]);
    setWsError('');
    setInviteResult(null);
  }, [isOpen]);

  const inviteMutation = useMutation<InviteBulkResult, Error, void>({
    mutationFn: async () => {
      if (validEmails.length === 0) throw new Error('No valid emails to invite.');
      if (selectedWorkspaces.length === 0) throw new Error('Select at least one workspace.');

      return inviteUsersBulk({
        emails: validEmails,
        workspaces: selectedWorkspaces,
      }) as Promise<InviteBulkResult>;
    },
    onSuccess: (data) => {
      setInviteResult(data);
      setStep(3);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send invites');
    },
  });

  const canNext = useMemo(() => {
    if (step === 0) return validEmails.length > 0;
    if (step === 1) return selectedWorkspaces.length > 0;
    return true;
  }, [step, validEmails, selectedWorkspaces]);

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

      setStep(1);
      toast.success(`Loaded ${valid.length} emails${invalid.length ? ` (${invalid.length} invalid)` : ''}.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to read file. Please try CSV with one email per line.';
      setFileError(message);
    }
  };

  const renderStepHeader = () => {
    const steps = [
      { label: 'Upload' },
      { label: 'Workspaces' },
      { label: 'Summary' },
      { label: 'Results' },
    ];

    const statusFor = (idx: number) =>
      step === (idx as Step) ? 'active' : step > (idx as Step) ? 'complete' : 'todo';

    return (
      <div className="chev-stepper mb-4">
        {steps.map((item, index) => {
          const state = statusFor(index);
          const classNames = [
            'chev-step',
            state,
            index === 0 ? 'first' : '',
            index === steps.length - 1 ? 'last' : '',
          ].join(' ');

          return (
            <div key={item.label} className={classNames} style={{ zIndex: steps.length - index }}>
              <div className="chev-tile">
                <span className="chev-label">{item.label}</span>
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
          onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
        />
        <small className="text-muted">
          CSV should contain a single column of email addresses. A header row like <code>email</code> is OK.
        </small>
      </FormGroup>

      {(validEmails.length > 0 || invalidEmails.length > 0) && (
        <div className="mt-3">
          <div><strong>Valid emails:</strong> {validEmails.length}</div>
          {validEmails.length > 0 ? (
            <div className="text-muted">
              {validEmails.slice(0, 5).join(', ')}{validEmails.length > 5 ? '…' : ''}
            </div>
          ) : null}
          <div className="mt-2"><strong>Invalid rows:</strong> {invalidEmails.length}</div>
          {invalidEmails.length > 0 ? (
            <div className="text-danger">
              {invalidEmails.slice(0, 5).join(', ')}{invalidEmails.length > 5 ? '…' : ''}
            </div>
          ) : null}
        </div>
      )}

      {fileError ? <div className="alert alert-danger mt-3">{fileError}</div> : null}
    </>
  );

  const renderWorkspaces = () => (
    <>
      <Label>Select workspace(s)</Label>
      <WorkspaceTable
        selected={selectedWorkspaces}
        onSelectionChange={(workspaces) => {
          setWsError('');
          setSelectedWorkspaces(workspaces);
        }}
      />
      {wsError ? <div className="text-danger mt-2">{wsError}</div> : null}
      <div className="mt-2 text-muted">Pick at least one workspace.</div>
    </>
  );

  const renderSummary = () => (
    <>
      <div className="mb-3">
        <strong>Invitations:</strong> {validEmails.length} user{validEmails.length === 1 ? '' : 's'}
        {invalidEmails.length > 0 ? (
          <span className="text-muted ms-2">({invalidEmails.length} invalid will be ignored)</span>
        ) : null}
      </div>

      <div className="mb-2">
        <strong>Workspaces:</strong>
        {selectedWorkspaceDetails.length === 0 ? (
          <span className="text-muted ms-2">None selected</span>
        ) : (
          <ul className="mt-2 mb-0">
            {selectedWorkspaceDetails.map((workspace) => (
              <li key={workspace.id}>
                <span className="me-2">{workspace.name}</span>
                {workspace.server ? <span className="text-muted">({workspace.server})</span> : null}
                {workspace.is_default ? <span className="badge qf-um-role-badge qf-um-role-badge-default ms-2">default</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="text-muted">
        On finish, invitations will be sent and you will receive an email summary (successes and failures).
      </div>
    </>
  );

  const renderResults = () => {
    if (!inviteResult) return <div className="text-muted">No result available.</div>;

    const { total_user_count, invites_sent, users_skipped, skipped_emails } = inviteResult;

    return (
      <>
        <div className="alert qf-um-results-card">
          <div className="fw-bold mb-1">Bulk Invite Results</div>
          <div>Total in file: <strong>{total_user_count}</strong></div>
          <div>Invites sent: <strong>{invites_sent}</strong></div>
          <div>Users skipped: <strong>{users_skipped}</strong></div>
        </div>

        {skipped_emails?.length > 0 ? (
          <div className="mt-3">
            <div className="fw-bold mb-2">Skipped emails</div>
            <ul className="mb-0">
              {skipped_emails.map((email) => (
                <li key={email} className="text-muted">{email}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </>
    );
  };

  const onNext = () => {
    if (step === 1 && selectedWorkspaces.length === 0) {
      setWsError('Please select at least one workspace.');
      return;
    }
    if (step < 2) setStep((current) => (current + 1) as Step);
  };

  const onBack = () => setStep((current) => (current > 0 ? (current - 1) as Step : current));
  const nextLabel = step === 2 ? (inviteMutation.isPending ? 'Submitting…' : 'Finish') : 'Next';

  return (
    <Modal
      isOpen={isOpen}
      toggle={onClose}
      size={size}
      className={`modal-tall ${className}`}
      scrollable={scrollable}
    >
      <ModalHeader toggle={onClose}>Invite Users</ModalHeader>
      <ModalBody className="px-4">
        {renderStepHeader()}
        {step === 0 ? renderUpload() : null}
        {step === 1 ? renderWorkspaces() : null}
        {step === 2 ? renderSummary() : null}
        {step === 3 ? renderResults() : null}
      </ModalBody>

      <ModalFooter className="w-100 d-flex">
        {step === 3 ? (
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
              {step < 2 ? (
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
