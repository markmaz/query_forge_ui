import { MenuItem } from "../../../../../entities/Layout";

export const menuList: MenuItem[] = [
  {
    title: "Wayfinder Applications",
    Items: [
      { id: 1, title: "Databricks", url: "/home", icon: "sample-page", type: "link" },
    ],
  },
  {
    title: "Dashboards",
    Items: [{ id: 2, title: "Chronic Dashboard", url: `https://support.pixelstrap.com/`, icon: "support-tickets", type: "link" }],
  },
];