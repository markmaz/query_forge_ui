import type { IndexStatus } from "@/features/system-admin/types";

interface Step {
  label: string;
  status: IndexStatus;
  detail?: string;
}

interface RebuildProgressProps {
  steps: Step[];
}

function StepIcon({ status }: { status: IndexStatus }) {
  if (status === "building") return <span className="sa-spinner" />;
  if (status === "completed") return <i className="fa fa-check" />;
  if (status === "error") return <i className="fa fa-times" />;
  return <i className="fa fa-circle-o" />;
}

export default function RebuildProgress({ steps }: RebuildProgressProps) {
  return (
    <div className="sa-stepper">
      {steps.map((step, i) => (
        <div className={`sa-step ${step.status}`} key={i}>
          <div className="sa-step-icon">
            <StepIcon status={step.status} />
          </div>
          <div className="sa-step-info">
            <div className="sa-step-label">{step.label}</div>
            {step.detail && (
              <div className="sa-step-detail">{step.detail}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
