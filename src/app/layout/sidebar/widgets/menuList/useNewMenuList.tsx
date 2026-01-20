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
    const token = localStorage.getItem("Token");
    if (token) dispatch(fetchUserWorkspaceDetail(token));
  }, [dispatch]);

  return [
    // keep anything static you already have, except we’ll re-insert "Wayfinder Applications"
    ...staticMenuList.filter((item) => item.title !== "Wayfinder Applications"),

    // Wayfinder Applications (visibility controlled by guard per item)
    {
      title: "Wayfinder Applications",
      Items: [
        {
          id: 0,                     
          title: "WorkSpace",
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
      title: "Cohort Assistant",
      id: 200,
      Items: [
        {
          id: 201,
          title: "Cohort Builder",
          url: routes.CohortBuilder,
          icon: "wrench",
          type: "link",
          guard: { product: "cohort builder", role: "user" },
        },
        {
          id: 202,
          title: "Cohort Analysis",
          url: routes.CohortAnalysis,
          icon: "magnifying-glass-chart",
          type: "link",
          guard: { product: "cohort analysis", role: "user" },
        },
        {
          id: 203,
          title: "My Cohorts",
          url: routes.CohortManagement,
          icon: "code",
          type: "link",
          guard: { product: "my cohorts", role: "user" },
        },        
      ],
    },
        {
      title: "No Code Query Builder",
      id: 300,
      Items: [
        {
          id: 301,
          title: "Query Builder",
          url: routes.NoCodeQueryBuilder,
          icon: "wand-magic-sparkles",
          type: "link",
          guard: { product: "no code builder", role: "user" },
        },
        {
          id: 302,
          title: "Builder Management",
          url: routes.NoCodeQueryManagement,
          icon: "gear",
          type: "link",
          guard: { product: "no code builder", role: "user" },
        },
      ],
    },
    {
      title: "Crosswalk Management",
      id: 400,
      Items: [
        {
          id: 401,
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
