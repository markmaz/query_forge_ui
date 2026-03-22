import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "../../../../core/store";
import { useAppSelector } from "../../../../../shared/runtime/hooks";
import { fetchDashboards } from "../../../../../features/insights/model/dashboardSlice";
import { useNewMenuList } from "./useNewMenuList";
import { MenuItem } from "../../../../../domain-model/Layout";

function toDashboardMenuItem(dashboard: any, index: number): MenuItem {
  const dashboardTitle = dashboard?.title ?? "Untitled Dashboard";
  return {
    id: index + 2,
    title: dashboardTitle,
    url: `/dashboard-view/${dashboard?.workbook_id ?? "unknown"}`,
    icon: "chart-simple",
    type: "link",
    guard: { feature: "workspaces", role: "user" },
  };
}

export const useDynamicMenuList = (): MenuItem[] => {
  const dispatch = useDispatch<AppDispatch>();
  const dashboards = useAppSelector((s) => s.dashboards.dashboards);
  const newMenuList = useNewMenuList();

  useEffect(() => {
    dispatch(fetchDashboards());
  }, [dispatch]);

  const dashboardItems: MenuItem[] = (Array.isArray(dashboards) ? dashboards : []).map(toDashboardMenuItem);

  return [
    ...newMenuList.filter((item) => item.title !== "Dashboards"),
    { title: "Dashboards", Items: dashboardItems },
  ];
};
