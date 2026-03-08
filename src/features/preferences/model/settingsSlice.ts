import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { jwtDecode } from "jwt-decode";
import { getAccessToken } from "../../../shared/runtime/accessTokenStore";
import { getUserWorkspaceDetails, setUserWorkspace } from "../../../shared/services/workspace";

type UserWorkspaceDetail = {
  workspace_id: string;
  server: string;
  name: string;
  is_default: number;
};

interface UserWorkspaceDetailState {
  workspaces: UserWorkspaceDetail[];
  defaultWorkspace: UserWorkspaceDetail | null;
  selectedWorkspaceId: string | null;
  needsWorkspaceSelection: boolean;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: UserWorkspaceDetailState = {
  workspaces: [],
  defaultWorkspace: null,
  selectedWorkspaceId: null,
  needsWorkspaceSelection: false,
  loaded: false,
  loading: false,
  error: null,
};

const getPersistedWorkspaceId = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("workspaceId");
  } catch {
    return null;
  }
};

const clearPersistedWorkspaceId = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("workspaceId");
  } catch {
    // ignore storage failures in sandboxed contexts
  }
};

export const fetchUserWorkspaceDetail = createAsyncThunk(
  "user/fetchUserWorksapceDetail",
  async (_: void, { rejectWithValue }) => {
    try {
      const token = getAccessToken();
      if (!token) return rejectWithValue("Missing access token");
      const decoded: any = jwtDecode(token);
      const data = await getUserWorkspaceDetails(decoded.sub);
      const workspaces = data ?? [];
      const persistedWorkspaceId = getPersistedWorkspaceId();
      const allowedWorkspaceIds = new Set(workspaces.map((w) => String(w.workspace_id)));
      const persistedWorkspaceValid =
        persistedWorkspaceId == null ? null : allowedWorkspaceIds.has(String(persistedWorkspaceId));
      if (persistedWorkspaceId && !persistedWorkspaceValid) {
        clearPersistedWorkspaceId();
      }

      return {
        workspaces,
        persistedWorkspaceId,
        persistedWorkspaceValid,
      };
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

export const updateUserDefaultWorkspace = createAsyncThunk(
  "user/updateDefaultWorkspace",
  async (
    { workspace_id }: { workspace_id: string },
    { dispatch, getState, rejectWithValue }
  ) => {
    const state = getState() as { userWorkspaces: UserWorkspaceDetailState };
    const allowedWorkspaceIds = new Set(
      (state.userWorkspaces.workspaces ?? []).map((w) => String(w.workspace_id))
    );
    if (!allowedWorkspaceIds.has(String(workspace_id))) {
      return rejectWithValue("Invalid workspace selection");
    }

    const token = getAccessToken();
    if (token) {
      const decoded: any = jwtDecode(token);
      await setUserWorkspace(decoded.sub, workspace_id);
      await dispatch(fetchUserWorkspaceDetail());
      return workspace_id;
    }
    return rejectWithValue("Missing access token");
  }
);


const settingsSlice = createSlice({
  name: "workspaces",
  initialState,
  reducers: {
    logoutUser(state) {
      state.workspaces = [];
      state.defaultWorkspace = null;
      state.selectedWorkspaceId = null;
      state.needsWorkspaceSelection = false;
      state.loaded = false;
      state.loading = false;
      state.error = null;
    },
    setSelectedWorkspace(state, action: PayloadAction<string>) {
      const requested = String(action.payload);
      const allowedWorkspaceIds = new Set((state.workspaces ?? []).map((w) => String(w.workspace_id)));
      if (!allowedWorkspaceIds.has(requested)) {
        state.error = "Invalid workspace selection";
        return;
      }
      state.selectedWorkspaceId = requested;
      state.needsWorkspaceSelection = false;
      state.error = null;
    },
    resetSelectedWorkspace(state) {
      state.selectedWorkspaceId = null;
      state.needsWorkspaceSelection = Boolean(state.workspaces?.length);
    },
    handleWorkspaceAccessDenied(state) {
      state.selectedWorkspaceId = null;
      state.needsWorkspaceSelection = Boolean(state.workspaces?.length);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserWorkspaceDetail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserWorkspaceDetail.fulfilled, (state, action) => {
        const payload = action.payload as
          | {
              workspaces: UserWorkspaceDetail[];
              persistedWorkspaceId: string | null;
              persistedWorkspaceValid: boolean | null;
            }
          | undefined;

        const workspaces = payload?.workspaces ?? [];
        const allowedWorkspaceIds = new Set(workspaces.map((w) => String(w.workspace_id)));
        const defaultWorkspace = workspaces.find((w) => w.is_default === 1) ?? null;

        let selectedWorkspaceId: string | null = null;
        const persistedWorkspaceId = payload?.persistedWorkspaceId ?? null;
        if (persistedWorkspaceId != null) {
          selectedWorkspaceId = payload?.persistedWorkspaceValid ? String(persistedWorkspaceId) : null;
        } else if (
          state.selectedWorkspaceId &&
          allowedWorkspaceIds.has(String(state.selectedWorkspaceId))
        ) {
          selectedWorkspaceId = String(state.selectedWorkspaceId);
        } else {
          selectedWorkspaceId = defaultWorkspace?.workspace_id ?? null;
        }

        state.workspaces = workspaces;
        state.defaultWorkspace = defaultWorkspace;
        state.selectedWorkspaceId = selectedWorkspaceId;
        state.needsWorkspaceSelection =
          persistedWorkspaceId != null
            ? !payload?.persistedWorkspaceValid && workspaces.length > 0
            : !selectedWorkspaceId && workspaces.length > 0;
        state.loaded = true;
        state.loading = false;
      })
      .addCase(fetchUserWorkspaceDetail.rejected, (state, action) => {
        state.error = action.payload as string;
        state.loaded = true;
        state.loading = false;
      })
      .addCase(updateUserDefaultWorkspace.fulfilled, (state, action) => {
        if (!action.payload) return;
        state.selectedWorkspaceId = String(action.payload);
        state.needsWorkspaceSelection = false;
      })
      .addCase(updateUserDefaultWorkspace.rejected, (state, action) => {
        state.error = (action.payload as string) ?? "Failed to update workspace";
      });
  },
});

export const {
  logoutUser,
  setSelectedWorkspace,
  resetSelectedWorkspace,
  handleWorkspaceAccessDenied,
} = settingsSlice.actions;
export default settingsSlice.reducer;
