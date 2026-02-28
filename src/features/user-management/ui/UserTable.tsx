import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { Modal, ModalBody, ModalFooter, ModalHeader, Input } from 'reactstrap';
import { useAppDispatch } from '../../../shared/lib/hooks';
import { RootState } from '../../../app/providers/store';
import { fetchUsers, fetchUserInfo, inviteUser, updateUserInfo, updateUserStatus, resendInvite, deleteUser } from '../../../shared/services/users'
import { UserResponse, UserProfile, UserProfileUpdate, UserRow } from '../../../entities/Users';
import StyledTable from '../../../shared/ui/StyledTable';
import UserActionsMenu from './UserActionsMenu/UserActionsMenu';
import UserModal from './InviteUserModal';
import { toast } from 'react-toastify';
import { resetPasswordRequest } from '../../../shared/services/auth';
import { useDebounce } from '../../../shared/lib//useDeboune';
import InviteUsersWizardModal from './ImportUserModal';
import { fetchUserProfile } from '../model/userSlice';

const UserTable: React.FC = () => {
  const dispatch = useAppDispatch();
  const myUserId = useSelector((s: RootState) => s.user.user?.user_id);
  const selectedStatus = useSelector((state: RootState) => state.statusFilter.selectedStatus);
  const [wizardOpen, setWizardOpen] = useState(false);
  // paging
  const [cursor, setCursor] = useState('');
  const [direction, setDirection] = useState<'forward' | 'backward' | ''>('');
  const [limit, setLimit] = useState(10);

  // search
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const queryClient = useQueryClient();

  const { data, isPending, isError, error } = useQuery<UserResponse, Error>({
    queryKey: ['users', selectedStatus, cursor, direction, limit, debouncedSearch],
    queryFn: () => fetchUsers(selectedStatus, limit, cursor, direction, debouncedSearch),
    placeholderData: keepPreviousData,   // ← keeps prior page while new one loads
    staleTime: 30_000,                   // optional: reduce refetch flicker
  });

  // reset paging when status or search changes
  useEffect(() => {
    setCursor('');
    setDirection('');
  }, [selectedStatus, debouncedSearch]);

  // ---- Modal state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'invite' | 'edit'>('edit');
  const [modalProfile, setModalProfile] = useState<UserProfile | undefined>(undefined);
  const [removeUserId, setRemoveUserId] = useState<string | null>(null);
  const [removeConfirmText, setRemoveConfirmText] = useState("");

  const openInviteModal = () => {
    setModalMode('invite');
    setModalProfile(undefined);
    setIsUserModalOpen(true);
  };

  const openEditModalFetch = async (userId: string) => {
    setModalMode('edit');
    const fullProfile = await fetchUserInfo(userId);
    setModalProfile(fullProfile);
    setIsUserModalOpen(true);
  };

  const closeUserModal = () => {
    setIsUserModalOpen(false);
    setModalProfile(undefined);
  };

  const closeRemoveModal = () => {
    setRemoveUserId(null);
    setRemoveConfirmText("");
  };

  const handleSave = async (payload: UserProfileUpdate) => {
    if (modalMode === 'invite') {
      await inviteUser(payload);
    } else {
      if (!modalProfile?.user_id) {
        console.error('No user_id available for edit.');
        return;
      }
      await updateUserInfo(payload);
    }
    queryClient.invalidateQueries({ queryKey: ['users'] });

    if (payload.user_id && myUserId && payload.user_id === myUserId) {
       dispatch(fetchUserProfile());
    }
  };


  // If your backend already filters by q, use server list as-is.
  // If not, you can enable this client-side fallback filter instead:
  const users = useMemo(() => {
    const list = data?.users ?? [];
    if (!debouncedSearch) return list;
    const q = debouncedSearch.toLowerCase();
    return list.filter(u =>
      (u.email || '').toLowerCase().includes(q)
    );
  }, [data?.users, debouncedSearch]);

  if (isPending) return <p>Loading users...</p>;
  if (isError) return <p>Error: {error.message}</p>;

  // actions (unchanged)
  const handleDeactivate = async (userId: string) => {
    try {
      await updateUserStatus({ user_id: userId, status: 'Inactive' });
      toast.success('User has been deactivated.');
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      await queryClient.invalidateQueries({ queryKey: ['userCounts'] });
    } catch (e: any) {
      toast.error('Something went wrong: ' + (e.message || 'Unknown error'));
    }
  };

  const handleResetPassword = async (email?: string | null) => {
    if (!email) return toast.error('No email present.');
    try {
      await resetPasswordRequest(email);
      toast.success('Password reset sent.');
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (e: any) {
      toast.error('Something went wrong: ' + (e.message || 'Unknown error'));
    }
  };

  const handleRestore = async (userId: string) => {
    try {
      await updateUserStatus({ user_id: userId, status: 'Active' });
      toast.success('User has been activated.');
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      await queryClient.invalidateQueries({ queryKey: ['userCounts'] });
    } catch (e: any) {
      toast.error('Something went wrong: ' + (e.message || 'Unknown error'));
    }
  };

  const handleResendInvite = async (email: string | null, userId: string) => {
    if (email === null) {
      toast.error('Cannot resend invite without email. Please invite them first.');
      return;
    }
    try {
      const payload: UserProfileUpdate = { user_id: userId, email, products: [], workspaces: [] };
      await resendInvite(payload);
      toast.success('Invite has been sent.');
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (e: any) {
      toast.error('Something went wrong: ' + (e.message || 'Unknown error'));
    }
  };

  const handleRemoveUser = async (userId: string) => {
    try {
      await deleteUser(userId);
      toast.success('User has been removed.');
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      await queryClient.invalidateQueries({ queryKey: ['userCounts'] });
    } catch (e: any) {
      toast.error('Something went wrong: ' + (e.message || 'Unknown error'));
    }
  };

  return (
    <div>
      {/* Search + Invite */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <input
          className="form-control"
          style={{ maxWidth: 360 }}
          type="search"
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div  className="d-flex align-items-center gap-2">
          <button className='btn btn-secondary md-0' onClick={() => setWizardOpen(true)}>
            <i className='fa fa-plus me-2'/>
            Import Users
          </button>
          <button className="btn btn-primary" onClick={openInviteModal}>
            <i className='fa fa-plus me-2'/>
            Invite User
          </button>
        </div>
      </div>
      <InviteUsersWizardModal
        size="xl"                 // wider, optional
        className="modal-tall"    // <-- new
        scrollable      
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onFinished={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
      />
      <StyledTable>
        <thead>
          <tr>
            <th>Email</th>
            <th>Status</th>
            <th>Last Seen</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user: UserRow) => (
            <tr key={user.user_id}>
              <td>
                <a
                  href="#"
                  onClick={async (e) => {
                    e.preventDefault();
                    await openEditModalFetch(user.user_id);
                  }}
                >
                  {user.email}
                </a>
              </td>
              <td>
                <span
                  className={`badge ${
                    user.status === 'Active'
                      ? 'bg-success'
                      : user.status === 'Invited'
                      ? 'bg-primary'
                      : user.status === 'Inactive'
                      ? 'bg-danger'
                      : 'bg-secondary'
                  }`}
                >
                  {user.status}
                </span>
              </td>
              <td>
                {user.status === 'Invited' ? 'Invite sent on: ' : ''}
                {user.status === 'Inactive' ? 'Deactivated on: ' : ''}
                {user.last_log_in ? new Date(user.last_log_in).toLocaleString() : '—'}
              </td>
              <td>
                <UserActionsMenu
                  userId={user.user_id}
                  userStatus={user.status}
                  onAction={async (id, action) => {
                    if (action === 'edit') {
                      const row = users.find((u) => u.user_id === id);
                      if (row) await openEditModalFetch(id);
                    } else if (action === 'deactivate') {
                      handleDeactivate(id);
                    } else if (action === 'reset_password') {
                      const row = users.find((u) => u.user_id === id);
                      handleResetPassword(row?.email);
                    } else if (action === 'restore') {
                      handleRestore(id);
                    } else if (action === 'manage_access') {
                      const row = users.find((u) => u.user_id === id);
                      if (row) await openEditModalFetch(id);
                    } else if (action === 'resend_invite') {
                      const row = users.find((u) => u.user_id === id);
                      if (row) await handleResendInvite(row.email, row.user_id);
                    } else if (action === 'remove_user') {
                      setRemoveUserId(id);
                    }
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </StyledTable>

      <div className="d-flex justify-content-between align-items-center mt-4">
        <div>
          <button
            className="btn btn-secondary btn-lg me-2"
            disabled={!data?.prev_cursor}
            onClick={() => {
              setCursor(data?.prev_cursor || '');
              setDirection('backward');
            }}
          >
             <i className='fa fa-chevron-left me-2'/>
            Previous
          </button>
          <button
            className="btn btn-secondary btn-lg"
            disabled={!data?.next_cursor}
            onClick={() => {
              setCursor(data?.next_cursor || '');
              setDirection('forward');
            }}
          >
            Next
           <i className='fa fa-chevron-right me-2'/>
          </button>
        </div>

        <div className="d-flex align-items-center">
          <label className="me-2 fw-bold">Results per page:</label>
          <select
            className="form-select"
            style={{ width: '100px' }}
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setCursor('');
              setDirection('');
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <UserModal
        isOpen={isUserModalOpen}
        toggle={closeUserModal}
        mode={modalMode}
        userProfile={modalProfile}
        onSave={handleSave}
      />

      <Modal isOpen={!!removeUserId} toggle={closeRemoveModal} centered>
        <ModalHeader toggle={closeRemoveModal}>Remove User</ModalHeader>
        <ModalBody>
          <p className="mb-3">
            Are you sure you want to delete this user and all associated data from the system? If so type
            {' '}
            <strong>delete user</strong>
            {' '}
            in the box below.
          </p>
          <Input
            type="text"
            placeholder="delete user"
            value={removeConfirmText}
            onChange={(e) => setRemoveConfirmText(e.target.value)}
          />
        </ModalBody>
        <ModalFooter>
          <button type="button" className="btn btn-outline-secondary" onClick={closeRemoveModal}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={async () => {
              if (!removeUserId) return;
              await handleRemoveUser(removeUserId);
              closeRemoveModal();
            }}
            disabled={removeConfirmText.trim() !== "delete user"}
          >
            Delete
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default UserTable;
