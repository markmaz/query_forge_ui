import React from "react";
import { SvgProps } from "../../domain-model/CoreComponents";

const SPRITE_PATH = "assets/svg/icon-sprite.svg";

const SvgIcon: React.FC<SvgProps> = (props) => {
  const baseUrl = import.meta.env.BASE_URL || "/";
  const iconHref = `${baseUrl}${SPRITE_PATH}#${props.iconId}`;

  return (
    <svg
      className={props.className}
      style={props.style}
      onClick={props.onClick}
    >
      <use href={iconHref} />
    </svg>
  );
};

export default SvgIcon;
