import { useState } from "react";
import { Href } from "../../../../../theme-constants";
import SvgIcon from "../../../../../shared/components/SvgIcon";
import { useAppSelector } from "../../../../../shared/runtime/hooks";
import { Link } from "react-router-dom";
import BookmarkBack from "./Back";
import BookmarkFront from "./Front";

const Bookmark = () => {
  const [show, setShow] = useState(false);
  const { flip } = useAppSelector((state) => state.layout);
  const toggle = () => setShow((value) => !value);

  return (
    <li className="onhover-dropdown">
      <Link to={Href} onClick={toggle}>
        <SvgIcon iconId="Bookmark" />
      </Link>
      <div className={`onhover-show-div bookmark-flip ${show ? "show" : ""}`}>
        <div className="flip-card">
          <div className={`flip-card-inner ${flip ? "flipped" : ""}`}>
            <BookmarkFront />
            <BookmarkBack />
          </div>
        </div>
      </div>
    </li>
  );
};

export default Bookmark;
