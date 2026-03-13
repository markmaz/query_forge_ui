import type { ForgeMatchWorkflowStep } from "../hooks";

type Step = {
  key: ForgeMatchWorkflowStep;
  label: string;
};

type Props = {
  currentStepIndex: number;
};

const STEPS: Step[] = [
  { key: "upload", label: "Upload" },
  { key: "extract", label: "Extract" },
  { key: "analyze", label: "Analyze" },
  { key: "review", label: "Review" },
  { key: "finalize", label: "Finalize" },
];

export default function ForgeMatchStepper({ currentStepIndex }: Props) {
  return (
    <section className="fm-card fm-stepper-card" aria-label="ForgeMatch workflow steps">
      <ol className="fm-stepper" role="list">
        {STEPS.map((step, index) => {
          const completed = index < currentStepIndex;
          const current = index === currentStepIndex;
          const future = index > currentStepIndex;

          return (
            <li
              key={step.key}
              className={`fm-step fm-step-${future ? "future" : completed ? "done" : "current"}`}
              aria-current={current ? "step" : undefined}
            >
              <span className="fm-step-index" aria-hidden="true">{completed ? "✓" : index + 1}</span>
              <span className="fm-step-label">{step.label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
