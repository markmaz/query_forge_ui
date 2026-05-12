import type { DragEvent } from "react";
import { useMemo, useState } from "react";

import {
  FLOWFORGE_ELEMENT_DND_MIME,
  FLOWFORGE_ELEMENTS,
  type FlowForgeElementDefinition,
} from "../model/workflowElements";
import { getWorkflowPaletteDoc } from "../model/workflowPaletteDocs";
import Icon from "@/shared/components/Icon";
import WorkflowPaletteHelpDrawer from "./WorkflowPaletteHelpDrawer";

interface FlowForgeElementPaletteProps {
  onAddElement: (element: FlowForgeElementDefinition) => void;
}

export default function FlowForgeElementPalette({
  onAddElement,
}: FlowForgeElementPaletteProps) {
  const [activeGuideType, setActiveGuideType] = useState<FlowForgeElementDefinition["type"] | null>(null);
  const activeGuide = useMemo(() => (activeGuideType ? getWorkflowPaletteDoc(activeGuideType) : undefined), [activeGuideType]);

  const handleDragStart = (
    event: DragEvent<HTMLElement>,
    element: FlowForgeElementDefinition,
  ) => {
    event.dataTransfer.setData(FLOWFORGE_ELEMENT_DND_MIME, JSON.stringify(element));
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="ff-palette-shell">
      <aside className="ff-palette-panel" aria-label="Workflow element palette">
        <div className="ff-palette-header">
          <div className="ff-eyebrow">Elements</div>
          <h2>Workflow Palette</h2>
          <p>Drag or click an element. Open a guide for plain-language help.</p>
        </div>
        <div className="ff-palette-list">
          {FLOWFORGE_ELEMENTS.map((element) => {
            const guide = getWorkflowPaletteDoc(element.type);
            return (
              <div key={element.type} className="ff-palette-card-shell">
                <button
                  type="button"
                  className="ff-palette-card"
                  draggable
                  onDragStart={(event) => handleDragStart(event, element)}
                  onDoubleClick={() => onAddElement(element)}
                  onClick={() => onAddElement(element)}
                  title={`${element.label}: ${element.description}`}
                  aria-label={`${element.label}. ${element.description}`}
                >
                  <span className="ff-palette-icon" aria-hidden="true">
                    <Icon provider="fa" pack="solid" name={element.icon} size={15} />
                  </span>
                  <span className="ff-palette-card-text">
                    <strong>{element.label}</strong>
                    <span>{element.type.replace(/_/g, " ")}</span>
                  </span>
                </button>
                {guide ? (
                  <button
                    type="button"
                    className={`ff-palette-guide-tab${activeGuideType === element.type ? " is-active" : ""}`}
                    onClick={() => setActiveGuideType(element.type)}
                    aria-label={`Open ${element.label} guide`}
                    title={`Open ${element.label} guide`}
                  >
                    <Icon provider="fa" pack="solid" name="circle-question" size={13} />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </aside>
      {activeGuide ? <WorkflowPaletteHelpDrawer doc={activeGuide} onClose={() => setActiveGuideType(null)} /> : null}
    </div>
  );
}
