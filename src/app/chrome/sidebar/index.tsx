import { ArrowLeft, ArrowRight } from "react-feather";
import { Link } from "react-router-dom";
import SimpleBar from "simplebar-react";
import { Back, Pinned } from "../../../theme-constants"
import { routes } from "../../navigation/routes";
import { dynamicImage } from "../../../src-utils";
import LogoWrapper from "./widgets/LogoWrapper";
import { useAppDispatch, useAppSelector } from "../../../shared/runtime/hooks";
import ConfigDB from "../../../config/ThemePalette";
import { scrollToLeft, scrollToRight } from "../../shell/model/themeCustomizerSlice";
import MenuList from "./widgets/menuList";
import { Image } from "../../../shared/components/Image";

const Sidebar = () => {
  const { pinnedMenu } = useAppSelector((state) => state.layout);
  const { margin, sideBarToggle } = useAppSelector((state) => state.themeCustomizer);
  const sidebarIconType = useAppSelector((state) => state.themeCustomizer.sideBarIconType);
  const sideBarIcon = sidebarIconType || ConfigDB.settings.sidebar.iconType;
  const dispatch = useAppDispatch();

  return (
    <div className={`sidebar-wrapper qf-sidebar ${sideBarToggle ? "close_icon" : ""}`} data-layout={`${sideBarIcon}-svg`}>
      <div>
        <LogoWrapper />
        <nav className="sidebar-main">
          <div className={`left-arrow ${margin >= 0 ? "disabled" : ""}`} onClick={() => dispatch(scrollToLeft())} id="left-arrow">
            <ArrowLeft />
          </div>
          <div id="sidebar-menu" style={{ position: "inherit", marginLeft: margin + "px" }}>
            <ul className="sidebar-links custom-scrollbar" id="simple-bar">
              <SimpleBar style={{ width: "68px", height: "calc(100vh - 100px)" }}>
                <li className="back-btn">
                  <Link to={routes.HomePage}>
                    <Image className="img-fluid" src={dynamicImage(`logo/logo-icon.png`)} alt="" />
                  </Link>
                  <div className="mobile-back text-end">
                    <span>{Back}</span>
                    <i className="fa fa-angle-right ps-2" />
                  </div>
                </li>
                <li className={`pin-title sidebar-main-title ${pinnedMenu.length > 0 ? "show" : ""}`}>
                  <div>
                    <h6>{Pinned}</h6>
                  </div>
                </li>
                <MenuList />
              </SimpleBar>
            </ul>
          </div>
          <div className={`right-arrow ${margin <= -3300 ? "disabled" : ""}`} onClick={() => dispatch(scrollToRight())} id="right-arrow">
            <ArrowRight />
          </div>
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;
