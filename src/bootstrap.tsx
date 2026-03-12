import { createRoot } from "react-dom/client";

import App from "./RootApp";
import "./i18n-config";

import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/qf-internal-theme.css";
import "./shared/styles/index.scss";
import "./styles/queryforge-bootstrap.css";
import "./features/list-ops/ui/styles/CustomDataManagement.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

import { AppProviders } from "./app/core/AppProviders";
import { RootErrorBoundary } from "./app/core/RootErrorBoundary";
import { initializeShellTheme } from "./app/core/themeBoot";

const el = document.getElementById("root");
if (!el) throw new Error("Root element #root not found");

initializeShellTheme();

createRoot(el).render(
  <RootErrorBoundary>
    <AppProviders>
        <App />
    </AppProviders>
  </RootErrorBoundary>
);
