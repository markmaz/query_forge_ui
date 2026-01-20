// src/app/providers/store.ts

import { configureStore } from "@reduxjs/toolkit";
import authSlice from "../../features/auth/model/authSlice";
import userSlice from "../../features/user-management/model/userSlice";
import LayoutSlice from "../layout/model/layoutSlice";
import dashboardReducer from "../../features/dashboards/model/dashboardSlice";
import dashboardEmbedSlice from "../../features/dashboards/model/dashboardEmbedSlice";
import setttingsSlice from "../../features/settings/model/settingsSlice";
import statusFilterReducer from "../../features/user-management/model/statusFilterSlice";
import workSpaceDetailsSlice from "../../features/workspaces/model/workspaceSlice"; // all workspaces
import currentWorkspaceSlice from "../../features/workspaces/model/userWorkspaceSlice"; // current workspace
import themeCustomizerReducer from "../layout/model/themeCustomizerSlice";
import cohortBuilderReducer from "../../features/cohort-builder/model/cohortBuilderSlice";

import { setApiWorkspaceId } from "../../shared/api/api"; // ✅ add this

export const rootReducer = {
  auth: authSlice,
  layout: LayoutSlice,
  dashboards: dashboardReducer,
  embedUrl: dashboardEmbedSlice,
  user: userSlice,
  userWorkspaces: setttingsSlice,
  statusFilter: statusFilterReducer,

  workspaces: workSpaceDetailsSlice,   // all workspaces
  workspace: currentWorkspaceSlice,    // ✅ current workspace

  themeCustomizer: themeCustomizerReducer,
  cohortBuilder: cohortBuilderReducer,
};

export const createAppStore = (preloadedState?: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState: preloadedState as any,
  });

export const store = createAppStore();

// ✅ TYPES (already correct)
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/* ======================================================
   👇👇👇 THIS GOES *AFTER* configureStore 👇👇👇
   ====================================================== */

let lastWorkspaceId: string | null = null;

store.subscribe(() => {
  const state = store.getState() as RootState;
  //const nextId = state.workspace?.workspace?.workspace_id ?? null;
  const nextId = state.userWorkspaces.defaultWorkspace?.workspace_id ?? null;

  if (nextId !== lastWorkspaceId) {
    lastWorkspaceId = nextId;
    setApiWorkspaceId(nextId);
  }
});
