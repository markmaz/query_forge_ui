import React from "react";
import { ChangeEvent, useEffect, useState } from "react";
import { Input } from "reactstrap";
import { menuList } from "../../sidebar/widgets/menuList/SidebarMenuList";
import { getLinkItemsArray, setResponsiveSearch } from "../../../shell/model/layoutSlice";
import { MenuItem, SearchItems } from "../../../../domain-model/Layout";
import SearchResults from "./common/SearchResults";
import { useAppDispatch, useAppSelector } from "../../../../shared/runtime/hooks";
import SvgIcon from "../../../../shared/components/SvgIcon";

function buildSuggestionArray() {
  const suggestionArray: SearchItems[] = [];
  let sequence = 0;

  const getAllLink = (item: MenuItem, icon: string | undefined) => {
    if (item.menu) {
      item.menu.forEach((ele) => getAllLink(ele, icon));
      return;
    }

    sequence += 1;
    suggestionArray.push({
      icon,
      title: item.title,
      url: item.url || "",
      bookmarked: false,
      id: sequence,
    });
  };

  menuList?.forEach((item) => item.Items?.forEach((child) => getAllLink(child, child.icon)));
  return suggestionArray;
}

const SearchInput = () => {
  const { responsiveSearch } = useAppSelector((state) => state.layout);
  const dispatch = useAppDispatch();
  const [arr, setArr] = useState<SearchItems[]>([]);
  const [searchedWord, setSearchedWord] = useState<string>("");
  const [searchedArray, setSearchedArray] = useState<SearchItems[]>([]);

  useEffect(() => {
    const suggestionArray = buildSuggestionArray();
    setArr(suggestionArray);
    dispatch(getLinkItemsArray(suggestionArray));
  }, [dispatch]);

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchedWord(value);
    setSearchedArray(arr.filter((item) => item.title?.toLowerCase().includes(value.toLowerCase())));
  };
  return (
    <li className="search_input">
      <div className="search-box" onClick={() => dispatch(setResponsiveSearch())}>
        <SvgIcon iconId="search" />
      </div>
      <div className={`form-group search-form ${responsiveSearch ? "open" : ""}`}>
        <Input type="text" placeholder="Search here..." value={searchedWord} onChange={(e) => handleSearch(e)} />
        <div className={`typeahead-menu custom-scrollbar ${searchedWord.length ? "is-open" : ""}`}>
          <SearchResults searchedArray={searchedArray} setSearchedWord={setSearchedWord} />
        </div>
      </div>
    </li>
  );
};
export default SearchInput;
