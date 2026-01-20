import { Link } from "react-router-dom";
import SvgIcon from "../../../../../shared/ui/SvgIcon";
import { useAppDispatch } from "../../../../../shared/lib/hooks";
import { SearchListProps } from "../../../../../entities/Layout";
import { setResponsiveSearch } from "../../../model/layoutSlice";
import { Fragment } from "react/jsx-runtime";
import SearchNotFoundClass from "../../../../../shared/ui/SearchNotFoundClass";

const SearchResults: React.FC<SearchListProps> = ({ searchedArray, setSearchedWord , onItemClick}) => {
  const dispatch = useAppDispatch();
  const handleSearch = (url: string) => {
    setSearchedWord("");
    dispatch(setResponsiveSearch());
    if (onItemClick) onItemClick(url);
  };
  return (
    <Fragment>
      {searchedArray?.map((item, index) => (
        <div className="Profile-Card u-cf" key={index}>
          <Link className="realname w-auto d-flex justify-content-start gap-2" to={item.url || ""} onClick={() => handleSearch(item.url || "")}>
            <div className="Profile-Card-details">
              <div className="Profile-Card-avatar">
                <SvgIcon className="stroke-icon svg-color" iconId={`stroke-${item.icon}`} />
              </div>
              <div className="Profile-Card-realName">{item.title}</div>
            </div>
          </Link>
        </div>
      ))}
      {!searchedArray?.length && <SearchNotFoundClass word="Page" />}
    </Fragment>
  );
};

export default SearchResults;
