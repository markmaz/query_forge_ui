import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchEmbedUrl } from "../../../shared/services/dashboards";
import { fetchWorkspaceInfo } from "../../../shared/services/workspace";
import { fetchUserInfo } from "../../../shared/services/users";
import { jwtDecode } from "jwt-decode";
import { getAccessToken } from "../../../shared/runtime/accessTokenStore";

export const fetchIframeUrl = createAsyncThunk(
  "iframe/fetchIframeUrl",
  async (id: string, { rejectWithValue }) => {
    try {
      const token = getAccessToken();

      if (!token) return rejectWithValue("Missing access token");

      const decoded = jwtDecode<{ sub?: string }>(token);
      const userId = typeof decoded.sub === "string" ? decoded.sub.trim() : "";
      if (!userId) return rejectWithValue("Missing user id in token");

      const userInfo = await fetchUserInfo(userId);
      if (!userInfo?.user_id) {
        return rejectWithValue("Unable to load user information");
      }
      const workspace = await fetchWorkspaceInfo(userInfo.user_id);

      if (!workspace) {
        return rejectWithValue("Default workspace not found");
      }

      const data = await fetchEmbedUrl(id, userInfo.user_id, workspace.workspace_id);
      return data.embed_url;

    } catch (error: unknown) {
      return rejectWithValue(error instanceof Error ? error.message : "Failed to fetch iFrame URL");
    }
  }
);

interface IframeState {
  url: string;
  loading: boolean;
  error: string | null;
}

const initialState: IframeState = {
  url: "",
  loading: false,
  error: null,
};

const iframeSlice = createSlice({
  name: "iframe",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchIframeUrl.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchIframeUrl.fulfilled, (state, action) => {
        state.loading = false;
        state.url = action.payload;
      })
      .addCase(fetchIframeUrl.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default iframeSlice.reducer;
