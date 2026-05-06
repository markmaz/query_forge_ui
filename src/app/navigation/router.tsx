import { lazy, Suspense } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";

import Layout from "../shell";
import RequireAuth from "./guards/RequireAuth";
import PublicOnly from "./guards/PublicOnly";
import Auth from "../../features/identity/ui";
import Error404 from "../../screens/Error404";
import { AppRoutes } from "./AppRoutes";
import { routes } from "./routes";

const FlowForgePublicActionPage = lazy(
  () => import("../../features/flowforge/ui/FlowForgePublicActionPage"),
);

function buildPublicArea(): RouteObject {
  return {
    element: <PublicOnly />,
    children: [
      {
        path: "auth",
        children: [
          { index: true, element: <Auth /> },
          { path: ":mode", element: <Auth /> },
        ],
      },
    ],
  };
}

function buildPrivateArea(): RouteObject {
  return {
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: AppRoutes,
      },
    ],
  };
}

function buildFallbackRoute(): RouteObject {
  return { path: "*", element: <Error404 /> };
}

export function createRootRouteTree(): RouteObject[] {
  return [
    {
      path: routes.FlowForgePublicAction,
      element: (
        <Suspense fallback={<div>Loading...</div>}>
          <FlowForgePublicActionPage />
        </Suspense>
      ),
    },
    buildPublicArea(),
    buildPrivateArea(),
    buildFallbackRoute(),
  ];
}

export function createAppRouter() {
  return createBrowserRouter(createRootRouteTree());
}

const router = createAppRouter();

export default router;
