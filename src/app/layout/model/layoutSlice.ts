import { createSlice } from "@reduxjs/toolkit";
import { BookmarkedItems, LayoutStateProps } from "../../../entities/Layout";
import { bookMarks } from "../../../app/layout/header/Header";

const initialState: LayoutStateProps = {
  pinnedMenu: [],
  responsiveSearch: false,
  linkItemsArray: [],
  flip: false,
  bookmarkedData: [...bookMarks],
};

const LayoutSlice = createSlice({
  name: "layout",
  initialState,
  reducers: {
    setPinnedMenu: (state, action) => {
      state.pinnedMenu = action.payload;
    },
    setResponsiveSearch: (state) => {
      state.responsiveSearch = !state.responsiveSearch;
    },
    getLinkItemsArray: (state, action) => {
      state.linkItemsArray = action.payload;
    },
    setFlip: (state) => {
      state.flip = !state.flip;
    },
    handleBookmarkChange: (state, action) => {
      if (!action.payload.bookmarked) {
        state.bookmarkedData.push({ ...action.payload, bookmarked: !action.payload.bookmarked });
      } else {
        const tempt: BookmarkedItems[] = [];
        state.bookmarkedData.forEach((ele) => {
          if (ele.id !== action.payload.id) {
            tempt.push(ele);
          }
        });
        state.bookmarkedData = tempt;
      }
      const temp = [...state.linkItemsArray];
      temp.splice(action.payload.id - 1, 1, { ...action.payload, bookmarked: !action.payload.bookmarked });
      state.linkItemsArray = temp;
    },
  },
});

export const { setPinnedMenu, setResponsiveSearch, getLinkItemsArray, setFlip, handleBookmarkChange } = LayoutSlice.actions;
export default LayoutSlice.reducer;
