import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { jwtDecode } from "jwt-decode";
import { getAccessToken } from "../../../shared/lib/accessTokenStore";
import { getUserWorkspaceDetails, setUserWorkspace } from '../../../shared/api/workspace';

type UserWorkspaceDetail = {
  workspace_id: string;
  server: string;
  name: string;
  is_default: number;
};

interface UserWorkspaceDetailState {
  workspaces: UserWorkspaceDetail[] | null;
  defaultWorkspace: UserWorkspaceDetail | null;
  loading: boolean;
  error: string | null;
}

const initialState: UserWorkspaceDetailState = {
  workspaces: [],
  defaultWorkspace: null,
  loading: false,
  error: null,
};

export const fetchUserWorkspaceDetail = createAsyncThunk(
  'user/fetchUserWorksapceDetail',
  async (_: void, { rejectWithValue }) => {
    try {
      const token = getAccessToken();
      if (!token) return rejectWithValue("Missing access token");
      const decoded: any = jwtDecode(token);
      const data = await getUserWorkspaceDetails(decoded.sub);

      if (!data) return null;
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

export const updateUserDefaultWorkspace = createAsyncThunk(
    "user/updateDefaultWorkspace",
    async ({  workspace_id }: { workspace_id: string }, { dispatch }) => {
        const token = getAccessToken();
        if (token){
            const decoded: any = jwtDecode(token);
            await setUserWorkspace(decoded.sub, workspace_id);
            dispatch(fetchUserWorkspaceDetail());
        }
    }
  );


const settingsSlice = createSlice({
  name: 'workspaces',
  initialState,
  reducers: {
    logoutUser: (state) => {
      state.workspaces = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserWorkspaceDetail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserWorkspaceDetail.fulfilled, (state, action) => {
        state.workspaces = action.payload ?? [];
        state.defaultWorkspace = state.workspaces.find((w) => w.is_default === 1) ?? null;
        state.loading = false;
      })
      .addCase(fetchUserWorkspaceDetail.rejected, (state, action) => {
        state.error = action.payload as string;
        state.loading = false;
      });
  },
});

export const { logoutUser } = settingsSlice.actions;
export default settingsSlice.reducer;
