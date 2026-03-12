import { createSlice } from "@reduxjs/toolkit";
import { BookmarkedItems, LayoutStateProps } from "../../../domain-model/Layout";
import { bookMarks } from "../../../app/chrome/topbar/Header";

const initialState: LayoutStateProps = {
  pinnedMenu: [],
  responsiveSearch: false,
  linkItemsArray: [],
  flip: false,
  bookmarkedData: [...bookMarks],
};

const toggleBookmark = (item: BookmarkedItems) => ({ ...item, bookmarked: !item.bookmarked });

function removeBookmarkedItem(items: BookmarkedItems[], id: number) {
  return items.filter((item) => item.id !== id);
}

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
      const nextItem = toggleBookmark(action.payload);

      if (!action.payload.bookmarked) {
        state.bookmarkedData.push(nextItem);
      } else {
        state.bookmarkedData = removeBookmarkedItem(state.bookmarkedData, action.payload.id);
      }

      const temp = [...state.linkItemsArray];
      temp.splice(action.payload.id - 1, 1, nextItem);
      state.linkItemsArray = temp;
    },
  },
});

export const { setPinnedMenu, setResponsiveSearch, getLinkItemsArray, setFlip, handleBookmarkChange } = LayoutSlice.actions;
export default LayoutSlice.reducer;
