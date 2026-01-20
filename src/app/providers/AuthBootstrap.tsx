// app/providers/AuthBootstrap.tsx
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../shared/lib/hooks';
import { fetchUserProfile } from '../../features/user-management/model/userSlice';

export default function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const initialized = useAppSelector(s => s.user.initialized);
  const loading = useAppSelector(s => s.user.loading);
  const token = localStorage.getItem('Token');

  useEffect(() => {
    if (token && !initialized && !loading) {
      dispatch(fetchUserProfile(token));
    }
  }, [token, initialized, loading, dispatch]);

  // If there’s a token, wait until user slice is initialized
  if (token && !initialized) return <div style={{padding:24}}>Loading…</div>;
  return <>{children}</>;
}
