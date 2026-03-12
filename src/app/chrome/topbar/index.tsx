import { Col, Row } from "reactstrap";

import LogoWrapper from "./actions/LogoWrapper";
// import SearchBar from "./actions/SearchBar";
// import SearchInput from "./actions/SearchInput";
// import FullScreen from "./actions/FullScreen";
// import Notification from "./actions/Notification";
// import Bookmark from "./actions/bookmark";
// import Message from "./actions/Message";
// import Cart from "./actions/cart";
// import Mode from "./actions/Mode";
// import Language from "./actions/Language";
import Profile from "./actions/Profile";

const Header = () => {

  //const { sideBarToggle } = useAppSelector((state) => state.themeCustomizer);

  return (
    <div className="page-header qf-topbar">
      <Row className="header-wrapper m-0">
        <LogoWrapper />
        {/* <SearchBar /> */}
        <Col xs="auto" lg="7" md="6" className="nav-right box-col-6 pull-right right-header p-0 ms-auto">
          <ul className="nav-menus">
            {/* <SearchInput /> */}
            {/* theme switch removed */}
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
