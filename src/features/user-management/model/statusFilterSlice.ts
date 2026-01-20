import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface StatusFilterState {
  selectedStatus: string;
}

const initialState: StatusFilterState = {
  selectedStatus: 'All',
};

const statusFilterSlice = createSlice({
  name: 'statusFilter',
  initialState,
  reducers: {
    setSelectedStatus(state, action: PayloadAction<string>) {
      state.selectedStatus = action.payload;
    },
  },
});

export const { setSelectedStatus } = statusFilterSlice.actions;
export default statusFilterSlice.reducer;
