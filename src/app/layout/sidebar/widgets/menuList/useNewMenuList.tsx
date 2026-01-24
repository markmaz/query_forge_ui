import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { menuList as staticMenuList } from "./SidebarMenuList";
import { MenuItem } from "../../../../../entities/Layout";
import { useAppSelector } from "../../../../../shared/lib/hooks";
import { fetchUserWorkspaceDetail } from "../../../../../features/settings/model/settingsSlice"
import { AppDispatch } from "../../../../providers/store";
import { routes } from "../../../../routes/routes";

export const useNewMenuList = (): MenuItem[] => {
  const dispatch = useDispatch<AppDispatch>();
  const { defaultWorkspace } = useAppSelector((state) => state.userWorkspaces);

  useEffect(() => {
    dispatch(fetchUserWorkspaceDetail());
  }, [dispatch]);

  return [
    // keep anything static you already have, except we’ll re-insert "Query Studio Applications"
    ...staticMenuList.filter((item) => item.title !== "Query Studio Applications"),

    // Query Studio Applications (visibility controlled by guard per item)
    {
      title: "Query Studio Applications",
      Items: [
        {
          id: 0,                     
          title: "Databricks",
          url: defaultWorkspace?.server ?? "#",
          icon: "screwdriver-wrench",
          type: "link",
          guard: { product: "workspace", role: "user" },
        },
      ],
    },

    // Admin (no top-level checks; items guarded)
    {
      title: "Admin",
      id: 100,
      Items: [
        {
          id: 101,
          title: "User Management",
          url: routes.UsermanagementView,
          icon: "users",
          type: "link",
          guard: { product: "user management", role: "admin" },
        },
        {
          id: 102,
          title: "Product Management",
          url: routes.ProductManagementView,
          icon: "list-check",
          type: "link",
          guard: { product: "product management", role: "admin" },
        },
      ],
    },
    {
      title: "Query Forge",
      id: 300,
      Items: [
        {
          id: 301,
          title: "Query Studio",
          url: routes.NoCodeQueryBuilder,
          icon: "wand-magic-sparkles",
          type: "link",
          guard: { product: "no code builder", role: "user" },
        },
        {
          id: 302,
          title: "Forge Management",
          url: routes.NoCodeQueryManagement,
          icon: "gear",
          type: "link",
          guard: { product: "no code builder", role: "user" },
        },
        {
          id: 304,
          title: "Data Dictionary",
          url: routes.NoCodeDataDictionary,
          icon: "book-open",
          type: "link",
          guard: { product: "dictionary", role: "user" },
        },
        {
          id: 303,
          title: "Crosswalk Manager",
          url: routes.CrosswalkManagement,
          icon: "right-left",
          type: "link",
          guard: { product: "crosswalk manager", role: "user" },
        },
      ],
    },          
  ];
};
