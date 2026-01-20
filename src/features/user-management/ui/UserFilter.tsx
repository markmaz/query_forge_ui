// components/StatusFilter.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../app/providers/store';
import { setSelectedStatus } from '../model/statusFilterSlice';
import { fetchUserCounts } from '../../../shared/api/users';
import './UserFilter.css'

const StatusFilter: React.FC = () => {
  const dispatch = useDispatch();
  const selectedStatus = useSelector((state: RootState) => state.statusFilter.selectedStatus);

  const { data: counts = {}, isLoading } = useQuery({
    queryKey: ['userCounts'],
    queryFn: fetchUserCounts,
    initialData: { All: 0, Active: 0, Inactive: 0, Invited: 0 },
  });

  const statuses = ['All', 'Active', 'Inactive', 'Invited'];

  return (
    <div className="status-filter">
      {statuses.map((status) => (
        <button
          key={status}
          className={`status-button ${selectedStatus === status ? 'active' : ''}`}
          onClick={() => dispatch(setSelectedStatus(status))}
          disabled={isLoading}
        >
          {status} ({isLoading ? '...' : counts[status] || 0})
        </button>
      ))}
    </div>
  );
};

export default StatusFilter;
