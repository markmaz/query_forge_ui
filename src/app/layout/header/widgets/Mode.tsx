import React from "react";
import { useAppDispatch } from "../../../../shared/lib/hooks";
import { addSideBarBackGround } from "../../model/themeCustomizerSlice";
import ConfigDB from "../../../../config/Theme";
import SvgIcon from "../../../../shared/ui/SvgIcon";

const Mode = () => {
  const dispatch = useAppDispatch();
  const darkModeHandler = (data: string) => dispatch(addSideBarBackGround(data));

  return (
    <li onClick={() => darkModeHandler(ConfigDB.color.mixBackgroundLayout !== "light" ? "light" : "dark-only")}>
      <div className={`mode ${ConfigDB.color.mixBackgroundLayout !== "light" ? "active" : ""}`}>
        <SvgIcon className="for-dark" iconId="moon" />
        <SvgIcon className="for-light" iconId="Sun" />
      </div>
    </li>
  );
};
export default Mode;
