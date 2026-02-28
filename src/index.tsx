import React, { Component } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import "./i18n";

import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/qf-internal-theme.css";
import "./shared/styles/index.scss";
import "./styles/queryforge-bootstrap.css";
import "./features/crosswalks/ui/styles/CustomDataManagement.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

import { store } from "./app/providers/store";
import { queryClient } from "./shared/lib/queryClient";

interface Props {
  children: React.ReactNode;
}

class ErrorBoundary extends Component<Props> {
  componentDidCatch(error: any) {
    // keep your ToastContainer suppression behavior
    const msg = String(error?.message ?? "");
    if (msg.includes("ToastContainer")) return;
  }

  render() {
    return this.props.children;
  }
}

const el = document.getElementById("root");
if (!el) throw new Error("Root element #root not found");

document.body.classList.remove("qf-theme-light", "light", "dark-sidebar");
document.body.classList.add("qf-theme-dark", "dark-only");

createRoot(el).render(
  <ErrorBoundary>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </Provider>
  </ErrorBoundary>
);
