// src/components/modals/AddGroupModal.tsx
import React, { useEffect, useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, FormGroup, Label, Input } from 'reactstrap';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';

// service you provide (POST /product_groups)
import { createProductGroup } from '../../../../shared/api/productGroup';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  existingNames: string[];   // for uniqueness check (case-insensitive)
  onSaved?: () => void;      // refresh hook
};

const AddGroupModal: React.FC<Props> = ({ isOpen, onClose, existingNames, onSaved }) => {
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setErr('');
    }
  }, [isOpen]);

  const createMut = useMutation({
    mutationFn: (groupName: string) => createProductGroup(groupName.trim()),
    onSuccess: () => {
      toast.success('Product group created');
      queryClient.invalidateQueries({ queryKey: ['productGroups'] });
      onSaved?.();
      onClose();
    },
    onError: (e: any) => {
      // If backend also enforces uniqueness, you might see 409 here
      if (e?.response?.status === 409) {
        setErr('A group with that name already exists.');
      } else {
        toast.error(e?.message ?? 'Failed to create group');
      }
    },
  });

  const handleSave = () => {
    const trimmed = name.trim();
    setErr('');
    if (!trimmed) {
      setErr('Group name is required.');
      return;
    }
    const exists = existingNames.some(n => (n || '').trim().toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setErr('A group with that name already exists.');
      return;
    }
    createMut.mutate(trimmed);
  };

  return (
    <Modal isOpen={isOpen} toggle={onClose}>
      <ModalHeader toggle={onClose}>Add Product Group</ModalHeader>
      <ModalBody>
        <FormGroup>
          <Label htmlFor="pgName">Product Group Name</Label>
          <Input
            id="pgName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            invalid={!!err}
            placeholder="Enter a unique group name"
          />
          {!!err && <small className="text-danger">{err}</small>}
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onClose} disabled={createMut.isPending}>Cancel</Button>
        <Button color="primary" onClick={handleSave} disabled={createMut.isPending}>
          {createMut.isPending ? 'Saving…' : 'Save'}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default AddGroupModal;
