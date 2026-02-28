import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { jwtDecode } from "jwt-decode";
import { fetchWorkspaceInfo } from '../../../shared/services/workspace';
import { WorkspaceDetail } from '../../../entities/Workspace';

interface WorkspaceState {
  workspace: WorkspaceDetail | null;
  loading: boolean;
  error: string | null;
}

const initialState: WorkspaceState = {
  workspace: null,
  loading: false,
  error: null,
};

export const fetchUserWorkspaceInfo = createAsyncThunk(
  'workspace/fetchCurrent',
  async (token: string, { rejectWithValue }) => {
    try {
      const decoded: any = jwtDecode(token);
      const data = await fetchWorkspaceInfo(decoded.sub);
      
      if (!data) return null
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    logoutUser: (state) => {
      state.workspace = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserWorkspaceInfo.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserWorkspaceInfo.fulfilled, (state, action) => {
        state.workspace = action.payload;
        state.loading = false;
      })
      .addCase(fetchUserWorkspaceInfo.rejected, (state, action) => {
        state.error = action.payload as string;
        state.loading = false;
      });
  },
});

export const { logoutUser } = workspaceSlice.actions;
export default workspaceSlice.reducer;
