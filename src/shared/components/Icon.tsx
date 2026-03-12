import React from "react";

type Provider = "fa" | "react" | "sprite";

type CommonProps = {
  size?: number | string;          // px or e.g. "1.25rem"
  color?: string;                  // e.g. "#333" or "currentColor"
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
};

type FA6Style =
  | "solid" | "regular" | "light" | "thin" | "duotone" | "brands" | "sharp";

type FA5Style = "fas" | "far" | "fal" | "fab"; // solid/regular/light/brands

type FAProps = CommonProps & {
  provider: "fa";
  /** The icon name without 'fa-' prefix, e.g. "user", "gear", "arrow-right" */
  name: string;
  /** Font Awesome 6 style (fa-solid, fa-regular, …) */
  pack?: FA6Style;
  /** If you're on FA5, set this instead of pack to one of fas/far/fal/fab */
  fa5Pack?: FA5Style;
  spin?: boolean;
};

type ReactIconProps = CommonProps & {
  provider: "react";
  /** A React SVG component, e.g. from lucide-react or heroicons */
  component: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

type SpriteProps = CommonProps & {
  provider: "sprite";
  /**
   * The sprite id. You can pass "icon-sprite.svg#download" or just "download"
   * If you pass only an id, the component will use PUBLIC_URL/assets/svg/icon-sprite.svg
   */
  spriteId: string;
  /** Optional sprite file if not using the default PUBLIC_URL one */
  spriteFile?: string; // e.g. "/assets/svg/another-sprite.svg"
};

export type IconProps = FAProps | ReactIconProps | SpriteProps;

function getCommonStyle(props: IconProps): React.CSSProperties {
  return {
    ...(props.size != null
      ? typeof props.size === "number"
        ? { fontSize: props.size, width: props.size, height: props.size }
        : { fontSize: props.size }
      : {}),
    ...(props.color ? { color: props.color } : {}),
    ...props.style,
  };
}

const Icon: React.FC<IconProps> = (props) => {
  const commonStyle = getCommonStyle(props);

  if (props.provider === "fa") {
    // Font Awesome
    const { name, pack, fa5Pack, spin, className, title, ...rest } = props;
    // Prefer FA6 pack class (fa-solid etc.), else fallback to FA5 (fas/far/fal/fab)
    const packClass = pack ? `fa-${pack}` : fa5Pack || "fa-solid";
    const spinClass = spin ? "fa-spin" : "";

    return (
      <i
        className={[packClass, `fa-${name}`, spinClass, className || ""]
          .filter(Boolean)
          .join(" ")}
        style={commonStyle}
        title={title}
        aria-hidden={props["aria-label"] ? undefined : true}
        {...rest}
      />
    );
  }

  if (props.provider === "react") {
    // React SVG component
    const { component: Cmp, className, title, ...rest } = props;
    const size =
      typeof props.size === "number"
        ? props.size
        : props.size
        ? parseFloat(String(props.size)) || undefined
        : undefined;

    return (
      <Cmp
        className={className}
        width={size}
        height={size}
        fill={props.color ? props.color : "currentColor"}
        style={commonStyle}
        aria-hidden={props["aria-label"] ? undefined : true}
        {...rest}
      >
        {title ? <title>{title}</title> : null}
      </Cmp>
    );
  }

  // SVG sprite
  const { spriteId, spriteFile, className, title, ...rest } = props;
  const hasHash = spriteId.includes("#");
  const file =
    spriteFile ??
    `${process.env.PUBLIC_URL ?? ""}/assets/svg/icon-sprite.svg`;
  const href = hasHash ? spriteId : `${file}#${spriteId}`;

  const sizePx =
    typeof props.size === "number" ? props.size : undefined;

  return (
    <svg
      className={className}
      style={commonStyle}
      width={sizePx}
      height={sizePx}
      aria-hidden={props["aria-label"] ? undefined : true}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {/* For Safari support, both href & xlinkHref can be set; here href generally works */}
      <use href={href} />
    </svg>
  );
};

export default Icon;
