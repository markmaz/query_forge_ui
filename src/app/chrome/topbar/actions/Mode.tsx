import React from "react";
import { useAppDispatch, useAppSelector } from "../../../../shared/runtime/hooks";
import { addSideBarBackGround } from "../../../shell/model/themeCustomizerSlice";
import SvgIcon from "../../../../shared/components/SvgIcon";

const Mode = () => {
  const dispatch = useAppDispatch();
  const mixBackgroundLayout = useAppSelector((state) => state.themeCustomizer.mixBackgroundLayout);
  const isDarkMode = mixBackgroundLayout !== "light";

  const toggleTheme = () => {
    dispatch(addSideBarBackGround(isDarkMode ? "light" : "dark-only"));
  };

  return (
    <li className="d-flex align-items-center">
      <div className={`mode form-check form-switch m-0 ps-0 ${isDarkMode ? "active" : ""}`}>
        <input
          className="form-check-input ms-0"
          type="checkbox"
          role="switch"
          id="qf-theme-toggle"
          checked={isDarkMode}
          onChange={toggleTheme}
          aria-label={isDarkMode ? "Switch to light theme" : "Switch to dark theme"}
        />
        <label className="form-check-label d-flex align-items-center gap-2 ms-2" htmlFor="qf-theme-toggle">
          <span className="visually-hidden">Toggle theme</span>
          <SvgIcon className="for-light" iconId="Sun" />
          <SvgIcon className="for-dark" iconId="moon" />
        </label>
      </div>
    </li>
  );
};
export default Mode;
