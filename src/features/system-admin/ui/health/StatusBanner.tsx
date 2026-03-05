interface StatusBannerProps {
  overall: "healthy" | "degraded" | "unhealthy";
}

const STATUS_TEXT: Record<StatusBannerProps["overall"], string> = {
  healthy: "All Systems Operational",
  degraded: "Some Services Degraded",
  unhealthy: "System Unhealthy",
};

const DOT_CLASS: Record<StatusBannerProps["overall"], string> = {
  healthy: "ok",
  degraded: "degraded",
  unhealthy: "error",
};

export default function StatusBanner({ overall }: StatusBannerProps) {
  return (
    <div className={`sa-status-banner ${overall}`}>
      <span className={`sa-status-dot ${DOT_CLASS[overall]}`} />
      {STATUS_TEXT[overall]}
    </div>
  );
}
