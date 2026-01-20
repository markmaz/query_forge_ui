import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "../../../../providers/store";
import { useAppSelector } from "../../../../../shared/lib/hooks";
import { fetchDashboards } from "../../../../../features/dashboards/model/dashboardSlice";
import { useNewMenuList } from "./useNewMenuList";
import { MenuItem } from "../../../../../entities/Layout";

export const useDynamicMenuList = (): MenuItem[] => {
  const dispatch = useDispatch<AppDispatch>();
  const dashboards = useAppSelector((s) => s.dashboards.dashboards);
  const newMenuList = useNewMenuList();

  useEffect(() => { dispatch(fetchDashboards()); }, [dispatch]);

  const dashboardItems: MenuItem[] = (Array.isArray(dashboards) ? dashboards : []).map((d, i) => ({
    id: i + 2,
    title: d?.title ?? 'Untitled Dashboard',
    url: `/dashboard-view/${d?.workbook_id ?? 'unknown'}`,
    icon: 'chart-simple',
    type: 'link',
    guard: { product: d?.title ?? '' },
  }));

  return [
    ...newMenuList.filter((item) => item.title !== 'Dashboards'),
    { title: 'Dashboards', Items: dashboardItems },
  ];
};

