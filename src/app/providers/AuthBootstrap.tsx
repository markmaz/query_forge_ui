// app/providers/AuthBootstrap.tsx
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../shared/lib/hooks';
import { fetchUserProfile } from '../../features/user-management/model/userSlice';
import { getAccessToken } from '../../shared/lib/accessTokenStore';
import { bootstrapAuth } from '../../features/auth/model/authSlice';
import { addSideBarBackGround } from '../layout/model/themeCustomizerSlice';

export default function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const initialized = useAppSelector(s => s.user.initialized);
  const loading = useAppSelector(s => s.user.loading);
  const token = getAccessToken();
  const authBootstrapped = useAppSelector(s => s.auth.bootstrapped);
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);

  useEffect(() => {
    if (!authBootstrapped) {
      dispatch(bootstrapAuth());
    }
  }, [authBootstrapped, dispatch]);

  useEffect(() => {
    if (token && !initialized && !loading) {
      dispatch(fetchUserProfile());
    }
  }, [token, initialized, loading, dispatch]);

  useEffect(() => {
    dispatch(addSideBarBackGround(isAuthenticated ? "light" : "dark-only"));
  }, [dispatch, isAuthenticated]);

  // If there’s a token, wait until user slice is initialized
  if (token && !initialized) return <div style={{padding:24}}>Loading…</div>;
  return <>{children}</>;
}
