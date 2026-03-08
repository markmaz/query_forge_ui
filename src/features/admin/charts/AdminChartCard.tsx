import type { ReactNode } from "react";

interface AdminChartCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function AdminChartCard({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: AdminChartCardProps) {
  return (
    <section className={`admin-chart-card ${className}`.trim()}>
      <header className="admin-chart-card__header">
        <div>
          <h3 className="admin-chart-card__title">{title}</h3>
          {subtitle ? <p className="admin-chart-card__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="admin-chart-card__actions">{actions}</div> : null}
      </header>
      <div className="admin-chart-card__body">{children}</div>
    </section>
  );
}
