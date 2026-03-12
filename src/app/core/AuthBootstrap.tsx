// app/core/AuthBootstrap.tsx
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../shared/runtime/hooks';
import { fetchUserProfile } from '../../features/access-admin/model/userSlice';
import { getAccessToken } from '../../shared/runtime/accessTokenStore';
import { bootstrapAuth } from '../../features/identity/model/authSlice';
import { addSideBarBackGround } from '../shell/model/themeCustomizerSlice';
import TokenWatcher from '../../shared/runtime/TokenWatcher';
import { fetchUserWorkspaceDetail } from '../../features/preferences/model/settingsSlice';

export default function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const initialized = useAppSelector(s => s.user.initialized);
  const loading = useAppSelector(s => s.user.loading);
  const token = getAccessToken();
  const authBootstrapped = useAppSelector(s => s.auth.bootstrapped);
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  const workspacesLoaded = useAppSelector(s => s.userWorkspaces.loaded);
  const workspacesLoading = useAppSelector(s => s.userWorkspaces.loading);
  const needsWorkspaceSelection = useAppSelector(s => s.userWorkspaces.needsWorkspaceSelection);

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
    if (!isAuthenticated) return;
    if (workspacesLoaded || workspacesLoading) return;
    dispatch(fetchUserWorkspaceDetail());
  }, [dispatch, isAuthenticated, workspacesLoaded, workspacesLoading]);

  useEffect(() => {
    if (!isAuthenticated || !workspacesLoaded || !needsWorkspaceSelection) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === "/settings" || window.location.pathname.startsWith("/auth")) return;
    window.location.href = "/settings";
  }, [isAuthenticated, needsWorkspaceSelection, workspacesLoaded]);

  useEffect(() => {
    dispatch(addSideBarBackGround(isAuthenticated ? "light" : "dark-only"));
  }, [dispatch, isAuthenticated]);

  // If there’s a token, wait until user slice is initialized
  if (token && !initialized) return <div style={{padding:24}}>Loading…</div>;
  return (
    <>
      <TokenWatcher />
      {children}
    </>
  );
}
