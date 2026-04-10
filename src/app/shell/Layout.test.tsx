import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type ThemeCustomizerState = {
  sidebarTypes: string;
  sideBarToggle: boolean;
};

const stateRef: { themeCustomizer: ThemeCustomizerState } = {
  themeCustomizer: {
    sidebarTypes: "compact-wrapper",
    sideBarToggle: false,
  },
};

const dispatchMock = vi.fn();

vi.mock("../../shared/runtime/hooks", () => ({
  useAppDispatch: () => dispatchMock,
  useAppSelector: (selector: (state: typeof stateRef) => unknown) =>
    selector(stateRef),
}));

vi.mock("../chrome/topbar", () => ({
  default: () => <div>Header</div>,
}));

vi.mock("../chrome/sidebar", () => ({
  default: () => <div>Sidebar</div>,
}));

vi.mock("./Footer", () => ({
  default: () => <div>Footer</div>,
}));

vi.mock("./TapTop", () => ({
  default: () => null,
}));

vi.mock("../navigation/guards/InactivityGuard", () => ({
  default: () => null,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    Outlet: () => <div>Outlet</div>,
  };
});

import Layout from "./index";

describe("Layout resize lifecycle", () => {
  beforeEach(() => {
    dispatchMock.mockClear();
    stateRef.themeCustomizer = {
      sidebarTypes: "compact-wrapper",
      sideBarToggle: false,
    };
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1400,
    });
  });

  it("registers and removes the resize listener with the same handler", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = render(<Layout />);

    const resizeAdds = addSpy.mock.calls.filter(([eventName]) => eventName === "resize");
    expect(resizeAdds).toHaveLength(1);
    const handler = resizeAdds[0]?.[1];
    expect(typeof handler).toBe("function");

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("resize", handler);
  });

  it("cleans up the previous resize listener before registering a new one on sidebar mode changes", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { rerender, unmount } = render(<Layout />);
    const firstResizeAdds = addSpy.mock.calls.filter(
      ([eventName]) => eventName === "resize",
    );
    const firstHandler = firstResizeAdds[0]?.[1];

    const addCountAfterFirstRender = firstResizeAdds.length;

    stateRef.themeCustomizer = {
      sidebarTypes: "horizontal-wrapper",
      sideBarToggle: false,
    };
    rerender(<Layout />);

    const resizeAdds = addSpy.mock.calls.filter(
      ([eventName]) => eventName === "resize",
    );
    expect(resizeAdds.length).toBeGreaterThan(addCountAfterFirstRender);
    expect(removeSpy).toHaveBeenCalledWith("resize", firstHandler);

    const secondHandler = resizeAdds[resizeAdds.length - 1]?.[1];
    expect(secondHandler).not.toBe(firstHandler);

    unmount();
    expect(removeSpy).toHaveBeenCalledWith("resize", secondHandler);
  });
});
