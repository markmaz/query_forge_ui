import { Col, Row } from "reactstrap";

import LogoWrapper from "./widgets/LogoWrapper";
// import SearchBar from "./widgets/SearchBar";
// import SearchInput from "./widgets/SearchInput";
import FullScreen from "./widgets/FullScreen";
// import Notification from "./widgets/Notification";
// import Bookmark from "./widgets/bookmark";
// import Message from "./widgets/Message";
// import Cart from "./widgets/cart";
// import Mode from "./widgets/Mode";
// import Language from "./widgets/Language";
import Profile from "./widgets/Profile";

const Header = () => {

  //const { sideBarToggle } = useAppSelector((state) => state.themeCustomizer);

  return (
    <div className={`page-header }`}>
      <Row className="header-wrapper m-0">
        <LogoWrapper />
        {/* <SearchBar /> */}
        <Col xs="auto" lg="7" md="6" className="nav-right box-col-6 pull-right right-header p-0 ms-auto">
          <ul className="nav-menus">
            {/* <SearchInput /> */}
            <FullScreen />
            <Profile/>
          </ul>
        </Col>
      </Row>
    </div>
  );
};

export default Header;


/**
 *             <Notification/>
            <Bookmark/>
            <Message/>
            <Cart/>
            <Mode/>
            <Language/>
 */