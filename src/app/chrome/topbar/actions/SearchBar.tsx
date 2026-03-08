import { useEffect, useState } from "react";
import { Col, Form, Input } from "reactstrap";
import { menuList } from "../../sidebar/widgets/menuList/SidebarMenuList";
import { MenuItem, SearchItems } from "../../../../domain-model/Layout";
import SearchResults from "./common/SearchResults";
import SvgIcon from "../../../../shared/components/SvgIcon";
import { useNavigate } from "react-router-dom";

function collectSearchItems() {
  const suggestionArray: SearchItems[] = [];

  const getAllLink = (item: MenuItem, icon: string | undefined) => {
    if (item.menu) {
      item.menu.forEach((ele) => getAllLink(ele, icon));
      return;
    }
    suggestionArray.push({ icon, title: item.title, url: item.url || "" });
  };

  menuList?.forEach((item) => item.Items?.forEach((child) => getAllLink(child, child.icon)));
  return suggestionArray;
}

const SearchBar = () => {
  const [arr, setArr] = useState<SearchItems[]>([]);
  const [searchedWord, setSearchedWord] = useState<string>("");
  const [searchedArray, setSearchedArray] = useState<SearchItems[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    setArr(collectSearchItems());
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchKey = e.target.value;
    setSearchedWord(searchKey);
    if (searchKey !== "") {
      document.body.classList.add("offcanvas");
      const result = arr.filter((item) => item.title?.toLowerCase().includes(searchKey.toLowerCase()));
      setSearchedArray(result);
    } else {
      document.body.classList.remove("offcanvas");
      setSearchedArray([]);
    }
  };

  const handleItemClick = (url: string) => {
    if (url) {
      navigate(url);
      setSearchedWord("");
      setSearchedArray([]);
      document.body.classList.remove("offcanvas");
    }
  };

  return (
    <Col sm="4" className="form-inline search-full d-none d-xl-block">
      <Form>
        <div className="form-group">
          <div className="typeahead">
            <div className="u-posRelative">
              <Input
                className="form-control-plaintext w-100"
                type="text"
                placeholder="Type to Search .."
                value={searchedWord}
                onChange={handleSearch}
              />
              <SvgIcon className="svg-color" iconId="search" />
            </div>
            <div className={`typeahead-menu custom-scrollbar ${searchedWord.length ? "is-open" : ""}`}>
              <SearchResults searchedArray={searchedArray} setSearchedWord={setSearchedWord} onItemClick={handleItemClick} />
            </div>
          </div>
        </div>
      </Form>
    </Col>
  );
};

export default SearchBar;
