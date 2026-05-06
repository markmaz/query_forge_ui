import { useState } from "react";

import type { FlowForgeElementDefinition } from "../model/workflowElements";
import { FLOWFORGE_ELEMENTS } from "../model/workflowElements";

interface FlowForgeAiAssistantPanelProps {
  open: boolean;
  onClose: () => void;
  onAddElement: (element: FlowForgeElementDefinition) => void;
}

function inferElement(prompt: string): FlowForgeElementDefinition {
  const normalized = prompt.toLowerCase();
  if (normalized.includes("schedule") || normalized.includes("daily") || normalized.includes("weekly")) {
    return FLOWFORGE_ELEMENTS.find((item) => item.type === "schedule_trigger") ?? FLOWFORGE_ELEMENTS[0];
  }
  if (normalized.includes("saved query") || normalized.includes("query extract") || normalized.includes("report")) {
    return FLOWFORGE_ELEMENTS.find((item) => item.type === "query_extract") ?? FLOWFORGE_ELEMENTS[0];
  }
  if (normalized.includes("export") || normalized.includes("sftp") || normalized.includes("s3") || normalized.includes("email")) {
    return FLOWFORGE_ELEMENTS.find((item) => item.type === "export") ?? FLOWFORGE_ELEMENTS[0];
  }
  if (normalized.includes("import") || normalized.includes("upload") || normalized.includes("inbound file")) {
    return FLOWFORGE_ELEMENTS.find((item) => item.type === "import") ?? FLOWFORGE_ELEMENTS[0];
  }
  if (normalized.includes("map") || normalized.includes("transform") || normalized.includes("validate")) {
    return FLOWFORGE_ELEMENTS.find((item) => item.type === "map_transform") ?? FLOWFORGE_ELEMENTS[0];
  }
  if (normalized.includes("approve") || normalized.includes("accept") || normalized.includes("human")) {
    return FLOWFORGE_ELEMENTS.find((item) => item.type === "approval") ?? FLOWFORGE_ELEMENTS[0];
  }
  if (normalized.includes("match") || normalized.includes("rank") || normalized.includes("filter") || normalized.includes("eligible")) {
    return FLOWFORGE_ELEMENTS.find((item) => item.type === "matching") ?? FLOWFORGE_ELEMENTS[0];
  }
  if (normalized.includes("decision") || normalized.includes("branch")) {
    return FLOWFORGE_ELEMENTS.find((item) => item.type === "decision") ?? FLOWFORGE_ELEMENTS[0];
  }
  return FLOWFORGE_ELEMENTS.find((item) => item.type === "intake") ?? FLOWFORGE_ELEMENTS[0];
}

export default function FlowForgeAiAssistantPanel({
  open,
  onClose,
  onAddElement,
}: FlowForgeAiAssistantPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<string[]>([
    "Describe the workflow you want to build. I can draft a next step while full LLM graph generation is wired in.",
  ]);

  if (!open) return null;

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    const suggested = inferElement(trimmed);
    setMessages((current) => [
      ...current,
      `You: ${trimmed}`,
      `Assistant: I added a ${suggested.label} as a draft step. Full multi-node generation will use the workspace FlowForge LLM role.`,
    ]);
    onAddElement(suggested);
    setPrompt("");
  };

  return (
    <section className="ff-ai-panel" aria-label="FlowForge AI assistant">
      <div className="ff-ai-panel-header">
        <div>
          <div className="ff-eyebrow">AI assistant</div>
          <h2>Build with natural language</h2>
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="ff-ai-messages">
        {messages.map((message, index) => (
          <p key={`${index}:${message}`}>{message}</p>
        ))}
      </div>
      <label className="ff-ai-prompt">
        Workflow prompt
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Example: Build an intake workflow that filters eligible therapists, sends an offer, and loops on decline."
        />
      </label>
      <button type="button" className="btn btn-primary" onClick={handleSubmit}>
        Draft next step
      </button>
    </section>
  );
}
