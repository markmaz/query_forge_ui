import { Fragment, useEffect, useMemo } from "react";
import { ChevronDown, ChevronRight } from "react-feather";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Href } from "../../../../../theme-constants"
import ConfigDB from "../../../../../config/ThemePalette";
import type { MenuItem as BaseMenuItem, MenuListProps } from "../../../../../domain-model/Layout";
import SvgIcon from "../../../../../shared/components/SvgIcon";
import Icon from "../../../../../shared/components/Icon";
import { useCan } from "../../../../../shared/runtime/useCan";

type Guard = { feature: string; role?: string | string[] };
type MenuItem = BaseMenuItem & { guard?: Guard };

const MenuChevron = ({ isOpen }: { isOpen: boolean }) =>
  isOpen ? (
    <ChevronDown className="submenu-chevron" aria-hidden="true" />
  ) : (
    <ChevronRight className="submenu-chevron" aria-hidden="true" />
  );

const isExternalUrl = (value?: string) =>
  typeof value === "string" &&
  /^(https?:)?\/\//i.test(value.trim());

const SubMenu: React.FC<MenuListProps> = ({ menu, setActiveMenu, activeMenu, level }) => {
  const location = useLocation();
  const { t } = useTranslation();
  const sideBarIcon = ConfigDB.settings.sidebar.iconType;
  const { hasFeature, hasRole } = useCan();

  const typedMenu = (menu ?? []) as MenuItem[];
  const routeSyncKey = useMemo(
    () =>
      typedMenu
        .map(
          (item) =>
            `${item.title ?? ""}:${item.url ?? ""}:${item.menu?.length ?? 0}`,
        )
        .join("|"),
    [typedMenu],
  );

  const isCurrentPath = (path?: string) => !!path && location.pathname === path;

  // Recursively check if any item (or its children) matches the current path
  const isItemActive = (item: MenuItem): boolean => {
    if (isCurrentPath(item.url)) return true;
    if (Array.isArray(item.menu)) return item.menu.some(isItemActive);
    return false;
  };

  // Initialize the active trail on mount
  useEffect(() => {
    const activeItem = typedMenu.find(isItemActive);
    if (!activeItem) return;

    setActiveMenu((previousMenu) => {
      if (previousMenu[level]?.title === activeItem.title) {
        return previousMenu;
      }

      const nextMenu = [...previousMenu];
      nextMenu[level] = activeItem;
      return nextMenu;
    });
  }, [level, location.pathname, routeSyncKey, setActiveMenu]);

  // Guard evaluation
  const canSee = (item: MenuItem) => {
    if (!item.guard) return true;
    const { feature, role } = item.guard;
    return role == null
      ? hasFeature(feature)
      : Array.isArray(role)
        ? role.some((r) => hasRole(feature, r))
        : hasRole(feature, role);
  };

  const visible = typedMenu.filter(canSee);

  return (
    <Fragment>
      {visible.map((item, i) => {
        const openByRoute = isItemActive(item);
        const openByState = activeMenu[level]?.title === item.title;
        const isOpen = openByRoute || openByState;

        const hasChildren = Array.isArray(item.menu) && item.menu.length > 0;
        const isDisabled = item.disabled === true;

        const liClass = [
          level === 0 ? "sidebar-list" : "",
          isOpen ? "active" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const linkClass = [
          level === 0 ? "sidebar-link sidebar-title" : "",
          level > 0 ? "sidebar-submenu-link" : "",
          isOpen ? "active" : "",
          isDisabled ? "disabled" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          
          <li key={`${level}-${i}-${item.title ?? "item"}`} className={liClass}>
            {/* {level === 0 && item.title && (
              <i
                className="fa fa-thumb-tack"
                onClick={() => handlePinned(item.title!)}
                role="button"
                aria-label={`Pin ${item.title}`}
              />
            )} */}

            {isDisabled ? (
              <span className={linkClass} aria-disabled="true">
                {item.icon && (
                  <Icon
                    provider="fa"
                    pack="solid"
                    name={item.icon}
                    size={14}
                  />
                )}
                {level === 0 ? (
                  <span>{t(`${item.title}`)}</span>
                ) : (
                  <span className="sidebar-submenu-text">{t(`${item.title}`)}</span>
                )}
                {hasChildren && (
                  <div className="according-menu">
                    <MenuChevron isOpen={isOpen} />
                  </div>
                )}
              </span>
            ) : isExternalUrl(item.url) ? (
              <a
                className={linkClass}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  const temp = [...activeMenu];
                  temp[level] = temp[level]?.title !== item.title ? item : ({} as MenuItem);
                  setActiveMenu(temp);
                }}
              >
                {item.icon && (
                  <Icon
                    provider="fa"
                    pack="solid"
                    name={item.icon}
                    size={14}
                  />
                )}
                {level === 0 ? (
                  <span>{t(`${item.title}`)}</span>
                ) : (
                  <span className="sidebar-submenu-text">{t(`${item.title}`)}</span>
                )}
                {hasChildren && (
                  <div className="according-menu">
                    <MenuChevron isOpen={isOpen} />
                  </div>
                )}
              </a>
            ) : (
              <Link
                className={linkClass}
                to={item.url ? item.url : Href}
                onClick={(e) => {
                  // If this is just a section header (no url), prevent navigation and toggle
                  if (!item.url) e.preventDefault();
                  const temp = [...activeMenu];
                  temp[level] = temp[level]?.title !== item.title ? item : ({} as MenuItem);
                  setActiveMenu(temp);
                }}
              >
                {item.icon && (
                  <Icon
                    provider="fa"
                    pack="solid"
                    name={item.icon}
                    size={14}
                    />
                )}
                {level === 0 ? (
                  <span>{t(`${item.title}`)}</span>
                ) : (
                  <span className="sidebar-submenu-text">{t(`${item.title}`)}</span>
                )}
                {hasChildren && (
                  <div className="according-menu">
                    <MenuChevron isOpen={isOpen} />
                  </div>
                )}
              </Link>
            )}

            {hasChildren && (
              <ul
                className={level !== 0 ? "submenu-content open-sub-mega-menu" : "sidebar-submenu"}
                style={{ display: isOpen ? "block" : "none" }}
              >
                <SubMenu
                  menu={item.menu}
                  activeMenu={activeMenu}
                  setActiveMenu={setActiveMenu}
                  level={level + 1}
                />
              </ul>
            )}
          </li>
        );
      })}
    </Fragment>
  );
};

export default SubMenu;
