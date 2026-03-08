import { ChangeEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "reactstrap";
import SvgIcon from "../../../../../shared/components/SvgIcon";
import { Back, Href } from "../../../../../theme-constants";
import { useAppDispatch, useAppSelector } from "../../../../../shared/runtime/hooks";
import { handleBookmarkChange, setFlip } from "../../../../shell/model/layoutSlice";
import { BookmarkedItems } from "../../../../../domain-model/Layout";

function filterBookmarks(query: string, items: BookmarkedItems[]) {
  const normalizedQuery = query.toLowerCase();
  return items.filter((item) => item.title?.toLowerCase().includes(normalizedQuery));
}

const BookmarkBack = () => {
  const dispatch = useAppDispatch();
  const [searchedItems, setSearchedItems] = useState<BookmarkedItems[]>([]);
  const [searchWord, setSearchWord] = useState("");
  const { linkItemsArray } = useAppSelector((store) => store.layout);

  const handleBackButton = () => {
    dispatch(setFlip());
    setSearchWord("");
  };

  const searchItems = (e: string) => {
    setSearchedItems(filterBookmarks(e, [...linkItemsArray]));
  };

  const bookMarkInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchWord(value);
    searchItems(value);
  };

  return (
    <div className="back">
      <ul>
        <li>
          <div className="bookmark-dropdown flip-back-content">
            <Input type="text" placeholder="search..." onChange={(e) => bookMarkInputChange(e)} value={searchWord} />
          </div>
          <div className={`py-0 typeahead-menu  ${searchWord ? "is-open" : ""} custom-scrollbar`}>
            {searchedItems?.map((item: BookmarkedItems, index: number) => (
              <div key={index} className="Profile-Card u-cf">
                <div className="Profile-Card-avatar">
                  <SvgIcon className={`fill-icon`} iconId={`fill-${item.icon}`} />
                </div>
                <div className="Profile-Card-details">
                  <div className="Profile-Card-realName">
                    <Link className="realname" to={Href}>
                      {item.title}
                    </Link>
                    <span className="pull-right">
                      <a href={Href}>
                        <SvgIcon iconId="fill-star" className={`svg-color icon-star ${linkItemsArray[item.id - 1].bookmarked ? "starred" : ""}`} onClick={() => dispatch(handleBookmarkChange(linkItemsArray[item.id - 1]))} />
                      </a>
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {!searchedItems.length && <p>Opps!! There are no result found.</p>}
          </div>
        </li>
        <li onClick={handleBackButton}>
          <a className="f-w-700 d-block" id="flip-back" href={Href}>
            {Back}
          </a>
        </li>
      </ul>
    </div>
  );
};

export default BookmarkBack;
