import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export const DEFAULT_DATASOURCE = "primary";

interface DatasourceState {
  selectedDatasource: string;
}

const initialState: DatasourceState = {
  selectedDatasource: DEFAULT_DATASOURCE,
};

const datasourceSlice = createSlice({
  name: "datasource",
  initialState,
  reducers: {
    setSelectedDatasource(state, action: PayloadAction<string>) {
      state.selectedDatasource = action.payload;
    },
  },
});

export const { setSelectedDatasource } = datasourceSlice.actions;
export default datasourceSlice.reducer;
