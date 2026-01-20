import { useNavigate } from "react-router-dom";
import { Col, Row } from "reactstrap";
import SvgIcon from "../../../../../shared/ui/SvgIcon";
import { AddNewBookmark, Bookmarks, Href } from "../../../../../constants";
import { useAppDispatch, useAppSelector } from "../../../../../shared/lib/hooks";
import { setFlip } from "../../../model/layoutSlice";

const BookmarkFront = () => {
  const { bookmarkedData } = useAppSelector((state) => state.layout);
  const dispatch = useAppDispatch();
  const router = useNavigate();

  return (
    <div className="front">
      <h6 className="f-18 mb-0 dropdown-title">{Bookmarks}</h6>
      <ul className="bookmark-dropdown">
        <li className="custom-scrollbar">
          <Row>
            {bookmarkedData.map((item, index) => (
              <Col xs="4" className="text-center" key={index}>
                <div className="bookmark-content" onClick={() => router(`${item.url}`)}>
                  <div className="bookmark-icon bg-light-primary">
                    <SvgIcon className={`stroke-icon`} iconId={`stroke-${item.icon}`} />
                  </div>
                  <span className="font-primary">{item.title}</span>
                </div>
              </Col>
            ))}
          </Row>
        </li>
        <li onClick={() => dispatch(setFlip())}>
          <a className="f-w-700" id="flip-btn" href={Href}>
            {AddNewBookmark}
          </a>
        </li>
      </ul>
    </div>
  );
};

export default BookmarkFront;
