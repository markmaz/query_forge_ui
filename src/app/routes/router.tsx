import { createBrowserRouter } from "react-router-dom";
import Layout from "../layout";
import RequireAuth from "./guards/RequireAuth";
import PublicOnly from "./guards/PublicOnly";
import Auth from "../../features/auth/ui";
import Error404 from "../../pages/Error404";
import { AppRoutes } from "./AppRoutes"; // your private app routes array

//const basename = import.meta.env.VITE_API_URL as string || "/";
const router = createBrowserRouter(
  [
    // Public-only area (unauthenticated users)
    {
      element: <PublicOnly />,
      children: [
        {
          path: "auth",               
          children: [
            { index: true, element: <Auth /> },          // /auth
            { path: ":mode", element: <Auth /> },        // /auth/otp
          ],
        },
        // Add other public routes here if you have them
      ],
    },

    // Private area (authenticated users)
    {
      element: <RequireAuth />,
      children: [
        {
          element: <Layout />,   // your main app shell
          children: [
            ...AppRoutes,        // e.g. [{ index: true, element: <Home /> }, { path: "dashboards", element: <Dash /> }, ...]
          ],
        },
      ],
    },

    // Catch-all
    { path: "*", element: <Error404 /> },
  ],
  { }
);

export default router;
