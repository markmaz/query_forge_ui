import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchDashboards as fetchDashboardsApi } from "../../../shared/api/dashboards";

// Async action to fetch dashboards
export const fetchDashboards = createAsyncThunk(
    "dashboards/fetchDashboards",
    async (_, { rejectWithValue }) => {
      try {
        const data = await fetchDashboardsApi();
        console.log("API Response:", data); // Debugging log
        if (!data) {
          throw new Error("API returned undefined or null");
        }
        return Array.isArray(data) ? data : []; // Ensure response is an array
      } catch (error: any) {
        console.error("Error fetching dashboards:", error);
        return rejectWithValue(error.response?.data || "Failed to fetch dashboards");
      }
    }
  );

const dashboardSlice = createSlice({
  name: "dashboards",
  initialState: {
    dashboards: [] as any,
    loading: false,
    error: null as string | null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboards.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDashboards.fulfilled, (state, action) => {
        state.loading = false;
        state.dashboards = action.payload.map((dashboard: any, index: number) => ({
          id: dashboard.workbookId,
          title: dashboard.name,
          url: dashboard.url,
          workbook_id: dashboard.workbookId,
          workbook_url_id: dashboard.workbookUrlId,
          icon: "support-tickets",
          type: "link",
        })) || [];
      })
      .addCase(fetchDashboards.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error?.message ?? "Unknown Error";
      });
  },
});

export default dashboardSlice.reducer;