import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type StatusFilterState = {
  selectedStatus: string;
};

const DEFAULT_STATUS = "All";

const initialState: StatusFilterState = {
  selectedStatus: DEFAULT_STATUS,
};

const slice = createSlice({
  name: "statusFilter",
  initialState,
  reducers: {
    setSelectedStatus: (state, action: PayloadAction<string>) => {
      state.selectedStatus = action.payload;
    },
    resetSelectedStatus: (state) => {
      state.selectedStatus = DEFAULT_STATUS;
    },
  },
});

export const { setSelectedStatus, resetSelectedStatus } = slice.actions;
export default slice.reducer;
