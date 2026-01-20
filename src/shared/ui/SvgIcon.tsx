import React from "react";
import { SvgProps } from "../../entities/CoreComponents";

const SvgIcon: React.FC<SvgProps> = (props) => {
  const baseUrl = import.meta.env.BASE_URL || "/";

  return (
    <svg
      className={props.className}
      style={props.style}
      onClick={props.onClick}
    >
      <use
        href={`${baseUrl}assets/svg/icon-sprite.svg#${props.iconId}`}
      />
    </svg>
  );
};

export default SvgIcon;