/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Footer from "./Footer";
import TapTop from "./TapTop";
import { useAppDispatch, useAppSelector } from "../../shared/runtime/hooks";
import { addSidebarTypes, setSideBarToggle } from "../shell/model/themeCustomizerSlice";
import Header from "../chrome/topbar";
import Sidebar from "../chrome/sidebar";
import InactivityGuard from '../navigation/guards/InactivityGuard';

const Layout = () => {
  const { sidebarTypes, sideBarToggle } = useAppSelector((state) => state.themeCustomizer);
  const dispatch = useAppDispatch();

  // function for sidebar type change from vertical to horizontal
  const updateSidebarBasedOnWidth = () => {
    const windowWidth = window.innerWidth;
    if (sidebarTypes === "compact-wrapper") {
      if (windowWidth <= 1200) dispatch(setSideBarToggle(true));
      else dispatch(setSideBarToggle(false));
    } else if (sidebarTypes === "horizontal-wrapper") {
      if (windowWidth <= 992) {
        dispatch(setSideBarToggle(true));
        dispatch(addSidebarTypes("compact-wrapper"));
      } else {
        dispatch(setSideBarToggle(false));
        dispatch(addSidebarTypes("horizontal-wrapper"));
      }
    }
  };
  useEffect(() => {
    updateSidebarBasedOnWidth();
    window.addEventListener("resize", () => updateSidebarBasedOnWidth());
  }, [sidebarTypes]);
  
  return (
    <>
      <InactivityGuard timeoutMs={30 * 60 * 1000} redirectTo="/auth" />
      <TapTop />
      <div className="qf-internal qf-app">
        <div className={`page-wrapper ${sideBarToggle ? "compact-wrapper" : sidebarTypes}`}>
          <Header />
          <div className="page-body-wrapper">
            <Sidebar />
            <div className="page-body qf-content">
              <div className="qf-page">
                <Outlet />
              </div>
            </div>
            <Footer />
          </div>
        </div>
      </div>

    </>
  );
};

export default Layout;
