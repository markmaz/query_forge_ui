import React, { Component } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import App from "./App";
import "./i18n";

import "bootstrap/dist/css/bootstrap.min.css";
import "./shared/styles/index.scss";
import "./features/crosswalks/ui/styles/CustomDataManagement.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

import { store } from "./app/providers/store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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

createRoot(el).render(
  <ErrorBoundary>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <App />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </Provider>
  </ErrorBoundary>
);