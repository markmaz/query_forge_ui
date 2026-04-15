import { Suspense, useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Loader from "./Loader";
import Footer from "./Footer";
import TapTop from "./TapTop";
import { useAppDispatch, useAppSelector } from "../../shared/runtime/hooks";
import {
  addSidebarTypes,
  setSideBarToggle,
} from "../shell/model/themeCustomizerSlice";
import Header from "../chrome/topbar";
import Sidebar from "../chrome/sidebar";
import InactivityGuard from "../navigation/guards/InactivityGuard";

const Layout = () => {
  const [zebraModeEnabled, setZebraModeEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem("qf.zebraMode") === "true";
  });
  const { sidebarTypes, sideBarToggle } = useAppSelector(
    (state) => state.themeCustomizer,
  );
  const dispatch = useAppDispatch();

  // function for sidebar type change from vertical to horizontal
  const updateSidebarBasedOnWidth = useCallback(() => {
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
  }, [dispatch, sidebarTypes]);

  useEffect(() => {
    updateSidebarBasedOnWidth();
    window.addEventListener("resize", updateSidebarBasedOnWidth);
    return () => {
      window.removeEventListener("resize", updateSidebarBasedOnWidth);
    };
  }, [updateSidebarBasedOnWidth]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      return (
        target.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if ((!event.ctrlKey && !event.metaKey) || !event.shiftKey) return;
      if (event.key.toLowerCase() !== "z") return;

      event.preventDefault();
      setZebraModeEnabled((previous) => {
        const next = !previous;
        window.sessionStorage.setItem("qf.zebraMode", String(next));
        return next;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <>
      <InactivityGuard timeoutMs={30 * 60 * 1000} redirectTo="/auth" />
      <TapTop />
      <div className="qf-internal qf-app">
        <div
          className={`page-wrapper ${sideBarToggle ? "compact-wrapper" : sidebarTypes}`}
        >
          <Header />
          <div className="page-body-wrapper">
            <Sidebar />
            <div
              className={`page-body qf-content ${zebraModeEnabled ? "qf-content-zebra" : ""}`}
              data-zebra-mode={zebraModeEnabled ? "enabled" : "disabled"}
            >
              <div className="qf-page">
                <Suspense fallback={<Loader />}>
                  <Outlet />
                </Suspense>
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
