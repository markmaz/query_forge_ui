// src/app/core/store.ts

import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authSlice from "../../features/identity/model/authSlice";
import userSlice from "../../features/access-admin/model/userSlice";
import LayoutSlice from "../shell/model/layoutSlice";
import dashboardReducer from "../../features/insights/model/dashboardSlice";
import dashboardEmbedSlice from "../../features/insights/model/dashboardEmbedSlice";
import setttingsSlice from "../../features/preferences/model/settingsSlice";
import statusFilterReducer from "../../features/access-admin/model/statusFilterSlice";
import workSpaceDetailsSlice from "../../features/tenant-admin/model/workspaceSlice"; // all workspaces
import currentWorkspaceSlice from "../../features/tenant-admin/model/userWorkspaceSlice"; // current workspace
import themeCustomizerReducer from "../shell/model/themeCustomizerSlice";
import datasourceReducer from "../../features/datasource/model/datasourceSlice";

import { setApiUserId, setApiWorkspaceId } from "../../shared/services/api"; // ✅ add this
import { clearWorkspaceScopedClientCaches } from "../../shared/runtime/queryClient";
import {
  WORKSPACE_ACCESS_DENIED_EVENT,
  type WorkspaceAccessDeniedDetail,
  emitWorkspaceAccessDeniedTelemetry,
} from "../../shared/runtime/workspaceAccess";
import { handleWorkspaceAccessDenied } from "../../features/preferences/model/settingsSlice";
import { toast } from "react-toastify";

export const rootReducer = combineReducers({
  auth: authSlice,
  layout: LayoutSlice,
  dashboards: dashboardReducer,
  embedUrl: dashboardEmbedSlice,
  user: userSlice,
  userWorkspaces: setttingsSlice,
  statusFilter: statusFilterReducer,

  workspaces: workSpaceDetailsSlice, // all workspaces
  workspace: currentWorkspaceSlice, // ✅ current workspace

  themeCustomizer: themeCustomizerReducer,
  datasource: datasourceReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export const createAppStore = (preloadedState?: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState: preloadedState as RootState | undefined,
  });
export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore["dispatch"];
export const store = createAppStore();

/* ======================================================
   👇👇👇 THIS GOES *AFTER* configureStore 👇👇👇
   ====================================================== */

type WorkspaceAwareStore = Pick<
  AppStore,
  "dispatch" | "getState" | "subscribe"
>;

export function attachWorkspaceHeaderSync(appStore: WorkspaceAwareStore) {
  let lastWorkspaceId: string | null = null;
  let lastUserId: string | null = null;
  return appStore.subscribe(() => {
    const state = appStore.getState() as RootState;
    const nextId = state.userWorkspaces.selectedWorkspaceId ?? null;
    const nextUserId = String(state.user?.user?.user_id ?? "") || null;

    if (nextId !== lastWorkspaceId) {
      lastWorkspaceId = nextId;
      setApiWorkspaceId(nextId);
      clearWorkspaceScopedClientCaches();
    }

    if (nextUserId !== lastUserId) {
      lastUserId = nextUserId;
      setApiUserId(nextUserId);
    }
  });
}

export function attachWorkspaceAccessDeniedListener(
  appStore: WorkspaceAwareStore,
) {
  if (typeof window === "undefined") return () => undefined;

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<WorkspaceAccessDeniedDetail>).detail;
    const state = appStore.getState() as RootState;
    const userId = String(state.user?.user?.user_id ?? "") || null;

    appStore.dispatch(handleWorkspaceAccessDenied());
    clearWorkspaceScopedClientCaches();
    toast.error("You no longer have access to this workspace.");

    emitWorkspaceAccessDeniedTelemetry({
      route: detail?.route ?? window.location.pathname,
      requested_workspace_id: detail?.requested_workspace_id ?? null,
      user_id: userId,
      timestamp: detail?.timestamp ?? new Date().toISOString(),
    });
  };

  window.addEventListener(
    WORKSPACE_ACCESS_DENIED_EVENT,
    handler as EventListener,
  );
  return () =>
    window.removeEventListener(
      WORKSPACE_ACCESS_DENIED_EVENT,
      handler as EventListener,
    );
}

attachWorkspaceAccessDeniedListener(store);
attachWorkspaceHeaderSync(store);
