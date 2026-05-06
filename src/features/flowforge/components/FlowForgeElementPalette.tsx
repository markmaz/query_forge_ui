import type { DragEvent } from "react";

import {
  FLOWFORGE_ELEMENT_DND_MIME,
  FLOWFORGE_ELEMENTS,
  type FlowForgeElementDefinition,
} from "../model/workflowElements";
import Icon from "@/shared/components/Icon";

interface FlowForgeElementPaletteProps {
  onAddElement: (element: FlowForgeElementDefinition) => void;
}

export default function FlowForgeElementPalette({
  onAddElement,
}: FlowForgeElementPaletteProps) {
  const handleDragStart = (
    event: DragEvent<HTMLElement>,
    element: FlowForgeElementDefinition,
  ) => {
    event.dataTransfer.setData(FLOWFORGE_ELEMENT_DND_MIME, JSON.stringify(element));
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <aside className="ff-palette-panel" aria-label="Workflow element palette">
      <div className="ff-palette-header">
        <div className="ff-eyebrow">Elements</div>
        <h2>Workflow Palette</h2>
        <p>Drag or click an element. Hover for details.</p>
      </div>
      <div className="ff-palette-list">
        {FLOWFORGE_ELEMENTS.map((element) => (
          <button
            key={element.type}
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
        ))}
      </div>
    </aside>
  );
}
