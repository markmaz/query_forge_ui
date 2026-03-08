import React, { useMemo, useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Input, Label, FormGroup, Spinner } from 'reactstrap';
import { useQuery } from '@tanstack/react-query';
import type { ProductRole } from '../../../../domain-model/ProductRole';
import { fetchRoles } from '../../../../shared/services/roles';

// Adjust this to your real roles service/type
export type Role = { role_id: string; role_name: string };
type Props = {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  assignedRoles?: ProductRole[];
  onSubmit: (roleId: string) => void;  // parent handles mutation
  isSubmitting?: boolean;
};

const AddRoleModal: React.FC<Props> = ({ isOpen, onClose, productName, assignedRoles, onSubmit, isSubmitting }) => {
  const { data: roles = [], isLoading, isError } = useQuery<Role[], Error>({
    queryKey: ['roles'],
    queryFn: fetchRoles,
    enabled: isOpen,
    placeholderData: (prev) => prev ?? [],
  });

  const assignedIds = useMemo(
    () => new Set((assignedRoles ?? []).map(r => r.role?.role_id).filter(Boolean) as string[]),
    [assignedRoles]
  );

  const available = roles.filter(r => !assignedIds.has(r.role_id));
  const [selected, setSelected] = useState<string>('');

  return (
    <Modal isOpen={isOpen} toggle={onClose}>
      <ModalHeader toggle={onClose}>Add Role to {productName}</ModalHeader>
      <ModalBody>
        {isLoading && <Spinner size="sm" />}
        {isError && <div className="text-danger">Failed to load roles.</div>}

        {!isLoading && available.length === 0 && (
          <div className="text-muted">No additional roles available.</div>
        )}

        {!isLoading && available.length > 0 && (
          <FormGroup>
            <Label htmlFor="roleSelect">Role</Label>
            <Input
              id="roleSelect"
              type="select"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Select a role…</option>
              {available.map(r => (
                <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
              ))}
            </Input>
          </FormGroup>
        )}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button
          color="primary"
          disabled={!selected || isSubmitting || available.length === 0}
          onClick={() => selected && onSubmit(selected)}
        >
          {isSubmitting ? 'Adding…' : 'Add Role'}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default AddRoleModal;
