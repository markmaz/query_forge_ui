import React from "react";
import {
  SectionShell as SharedSectionShell,
  type SectionShellProps as SharedSectionShellProps,
} from "../../../../shared/components/SectionShell";

export type SectionShellProps = SharedSectionShellProps & {
  headerTone?: "default" | "accent";
};

function mergeClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ").trim();
}

function buildRightSlot(
  headerTone: SectionShellProps["headerTone"],
  right: SectionShellProps["right"]
) {
  if (!right) return right;
  if (headerTone !== "accent") return right;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 6px",
        borderRadius: 999,
        background: "rgba(249, 115, 22, 0.1)",
      }}
    >
      {right}
    </span>
  );
}

export function SectionShell({
  className,
  headerTone = "default",
  right,
  ...rest
}: SectionShellProps) {
  const mergedClassName = mergeClassNames(
    "qf-section-shell",
    headerTone === "accent" ? "qf-section-shell-accent" : undefined,
    className
  );

  return (
    <SharedSectionShell
      {...rest}
      right={buildRightSlot(headerTone, right)}
      className={mergedClassName}
    />
  );
}
