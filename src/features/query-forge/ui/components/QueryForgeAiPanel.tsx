import type { Dispatch, SetStateAction } from "react";

import { AiCopilotFloatingButton } from "../ai/AiCopilotFloatingButton";
import { AiCopilotDrawer } from "../ai/AiCopilotDrawer";
import type { AiSuggestion } from "../ai/types";
import type { SqlQueryJson } from "../../model/sqlJson";
import { AI_COPILOT_DRAWER_INSTANCE_VERSION } from "../queryForgePageUtils";

type QueryForgeAiPanelProps = {
  aiOpen: boolean;
  aiResetNonce: number;
  workspaceId: string | null;
  userId: string | null;
  sqlJson: SqlQueryJson | null;
  domainContext: unknown;
  candidates: unknown;
  initialPrompt?: string | null;
  setAiOpen: Dispatch<SetStateAction<boolean>>;
  onApplySuggestion: (suggestion: AiSuggestion) => void;
  onToggle: () => void;
};

export function QueryForgeAiPanel({
  aiOpen,
  aiResetNonce,
  workspaceId,
  userId,
  sqlJson,
  domainContext,
  candidates,
  initialPrompt,
  setAiOpen,
  onApplySuggestion,
  onToggle,
}: QueryForgeAiPanelProps) {
  return (
    <>
      <div
        className={`ncqv2-ai-backdrop ${aiOpen ? "is-open" : ""}`}
        onClick={() => setAiOpen(false)}
      />
      <aside
        className={`ncqv2-ai-drawer ${aiOpen ? "is-open" : ""}`}
        role="dialog"
        aria-label="AI Copilot drawer"
        aria-hidden={!aiOpen}
      >
        <div className="ncqv2-ai-drawer-content">
          <AiCopilotDrawer
            key={`ai-copilot-v${AI_COPILOT_DRAWER_INSTANCE_VERSION}-${aiResetNonce}`}
            activeSection="AI First"
            workspaceId={workspaceId}
            userId={userId}
            sqlJson={sqlJson}
            domainContext={domainContext}
            candidates={candidates}
            initialPrompt={initialPrompt}
            onApplySuggestion={onApplySuggestion}
            onClose={() => setAiOpen(false)}
          />
        </div>
      </aside>

      <AiCopilotFloatingButton isActive={aiOpen} onToggle={onToggle} />
    </>
  );
}
