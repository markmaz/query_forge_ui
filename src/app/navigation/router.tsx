import { createBrowserRouter, type RouteObject } from "react-router-dom";

import Layout from "../shell";
import RequireAuth from "./guards/RequireAuth";
import PublicOnly from "./guards/PublicOnly";
import Auth from "../../features/identity/ui";
import Error404 from "../../screens/Error404";
import { AppRoutes } from "./AppRoutes";

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
  return [buildPublicArea(), buildPrivateArea(), buildFallbackRoute()];
}

export function createAppRouter() {
  return createBrowserRouter(createRootRouteTree());
}

const router = createAppRouter();

export default router;

