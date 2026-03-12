import { Component, type ReactNode } from "react";

type RootErrorBoundaryProps = {
  children: ReactNode;
};

export class RootErrorBoundary extends Component<RootErrorBoundaryProps> {
  componentDidCatch(error: unknown) {
    const message = String((error as { message?: string })?.message ?? "");
    if (message.includes("ToastContainer")) return;
  }

  render() {
    return this.props.children;
  }
}

