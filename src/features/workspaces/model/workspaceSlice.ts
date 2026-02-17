import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWorkspaces } from '../../../shared/services/workspace';
import { WorkspaceDetail } from '../../../entities/Workspace';

interface WorkspaceState {
  workspaces: WorkspaceDetail[];
  loading: boolean;
  error: string | null;
}


const initialState: WorkspaceState = {
  workspaces: [],
  loading: false,
  error: null,
};


export const fetchWorkspaceInfo = createAsyncThunk(
  'workspaces/fetchAll',
  async (_, thunkAPI) => {
    try {
      const data = await fetchWorkspaces();
      if (!data) return null
      return data;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err.message);
    }
  }
);

const workspaceSlice = createSlice({
  name: 'workspaces',
  initialState,
  reducers: {
    logoutUser: (state) => {
      state.workspaces = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWorkspaceInfo.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWorkspaceInfo.fulfilled, (state, action) => {
        state.workspaces = action.payload || [];
        state.loading = false;
      })
      .addCase(fetchWorkspaceInfo.rejected, (state, action) => {
        state.error = action.payload as string;
        state.loading = false;
      });
  },
});

export const { logoutUser } = workspaceSlice.actions;
export default workspaceSlice.reducer;
