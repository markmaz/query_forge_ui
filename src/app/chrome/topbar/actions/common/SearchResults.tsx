import { Link } from "react-router-dom";
import SvgIcon from "../../../../../shared/components/SvgIcon";
import { useAppDispatch } from "../../../../../shared/runtime/hooks";
import { SearchListProps } from "../../../../../domain-model/Layout";
import { setResponsiveSearch } from "../../../../shell/model/layoutSlice";
import SearchNotFoundClass from "../../../../../shared/components/SearchNotFoundClass";

const SearchResults: React.FC<SearchListProps> = ({ searchedArray, setSearchedWord, onItemClick }) => {
  const dispatch = useAppDispatch();

  const handleSearch = (url: string) => {
    setSearchedWord("");
    dispatch(setResponsiveSearch());
    onItemClick?.(url);
  };

  return (
    <>
      {searchedArray?.map((item, index) => (
        <div className="Profile-Card u-cf" key={index}>
          <Link
            className="realname w-auto d-flex justify-content-start gap-2"
            to={item.url || ""}
            onClick={() => handleSearch(item.url || "")}
          >
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
    </>
  );
};

export default SearchResults;
