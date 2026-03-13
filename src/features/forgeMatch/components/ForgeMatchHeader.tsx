type Props = {
  statusLabel: "uploaded" | "analyzing" | "analyzed" | "in review" | "finalized" | "error" | null;
};

function statusClass(status: Props["statusLabel"]): string {
  if (status === "finalized") return "fm-header-status-finalized";
  if (status === "in review") return "fm-header-status-review";
  if (status === "analyzing") return "fm-header-status-analyzing";
  if (status === "error") return "fm-header-status-error";
  return "fm-header-status-default";
}

export default function ForgeMatchHeader({ statusLabel }: Props) {
  return (
    <header className="fm-hero">
      <div>
        <h1>ForgeMatch</h1>
        <p>AI-assisted source field mapping with auditable retrieval, constrained ranking, and human review.</p>
      </div>
      {statusLabel ? (
        <span className={`fm-header-status ${statusClass(statusLabel)}`} aria-label={`Session status ${statusLabel}`}>
          {statusLabel}
        </span>
      ) : null}
    </header>
  );
}
