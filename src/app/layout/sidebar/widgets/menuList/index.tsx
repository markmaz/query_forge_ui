import { useState, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../../../../../shared/lib/hooks";
import SubMenu from "./SubMenu";
import { MenuItem as BaseMenuItem } from "../../../../../entities/Layout";
import { useNewMenuList } from "./useNewMenuList";
import { useCan } from "../../../../../shared/lib/useCan";

type Guard = { product: string; role?: string | string[] };
type MenuItem = BaseMenuItem & { guard?: Guard };

const MenuList = () => {
  const { pinnedMenu } = useAppSelector((state) => state.layout);
  const [activeMenu, setActiveMenu] = useState<MenuItem[]>([]);
  const { t } = useTranslation();
  const menuList = useNewMenuList();
  const { hasProduct, hasRole } = useCan();

  // same visibility logic used in SubMenu
  const canSee = (item: MenuItem) => {
    if (!item.guard) return true;
    const { product, role } = item.guard;
    if (!product) return true;
    return role == null
      ? hasProduct(product)
      : Array.isArray(role)
      ? role.some((r) => hasRole(product, r))
      : hasRole(product, role);
  };

  const visibleItems = (items?: MenuItem[]) => (items ?? []).filter(canSee);

  // Hide header when there are no visible items OR when all items are pinned (your original rule)
  const shouldHideMenu = (mainMenu: MenuItem) => {
    const visible = visibleItems(mainMenu.Items as MenuItem[]);
    if (visible.length === 0) return true; // nothing allowed -> hide section title

    // keep your pinned rule
    if (Array.isArray(mainMenu.Items) && mainMenu.Items.length > 0) {
      return mainMenu.Items.every((data) => pinnedMenu.includes(data.title));
    }
    return false;
  };

  return (
    <>
      {menuList.map((mainMenu: MenuItem, index: number) => {
        const itemsForThisSection = visibleItems(mainMenu.Items as MenuItem[]);
        if (shouldHideMenu(mainMenu)) return null;

        return (
          <Fragment key={index}>
            <li className={`sidebar-main-title`}>
              <div>
                <h6>{t(`${mainMenu.title}`)}</h6>
              </div>
            </li>
            {/* pass only visible items down; SubMenu will still enforce guard at deeper levels */}
            <SubMenu
              menu={itemsForThisSection}
              activeMenu={activeMenu}
              setActiveMenu={setActiveMenu}
              level={0}
            />
          </Fragment>
        );
      })}
    </>
  );
};

export default MenuList;
