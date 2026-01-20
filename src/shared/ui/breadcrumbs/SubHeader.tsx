import { useDynamicMenuList } from "../../../app/layout/sidebar/widgets/menuList/useDynamicMenuList";
import { MenuItem } from "../../../entities/Layout";
import SubHeaderList from "./SubHeaderList";

const SubHeader = () => {
  const menuList = useDynamicMenuList();
  
  return (
    <div className="left-header p-0">
      <div className="left-menu-header">
        <ul className="header-left">
          {menuList?.filter((item:MenuItem) => item.title !== "Forms & Table").map((mainMenu, index) => (
            <li className={`onhover-dropdown ${index === 4 ? " p-0" : ""}`} key={index}>
              <span className="f-w-700">{mainMenu.title} </span>
              <ul className="onhover-show-div">
                  <SubHeaderList menu={mainMenu.Items} level={0}/>
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SubHeader;