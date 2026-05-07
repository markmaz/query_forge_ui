import type { FlowForgeCommunicationTemplateAction, FlowForgeCommunicationTemplateBlockType } from "../model/communicationTemplateTypes";
import { BLOCK_PALETTE } from "../model/communicationTemplateBuilder";
import { TEMPLATE_BLOCK_DND_MIME } from "./communicationTemplateDnd";

export default function CommunicationTemplateBlockPalette({
  allowedActions,
  onAddBlock,
}: {
  allowedActions: FlowForgeCommunicationTemplateAction[];
  onAddBlock: (type: FlowForgeCommunicationTemplateBlockType) => void;
}) {
  return (
    <aside className="ff-template-builder-pane ff-template-block-palette-pane" aria-label="Block palette">
      <div className="ff-pane-heading">
        <span>Block Palette</span>
        <strong>Content blocks</strong>
      </div>
      <div className="ff-template-palette-list">
        {BLOCK_PALETTE.map((item) => {
          const disabled = item.type === "action_buttons" && !allowedActions.length;
          return (
            <button
              type="button"
              key={item.type}
              className="ff-template-palette-item"
              disabled={disabled}
              draggable={!disabled}
              title={disabled ? "This purpose does not support email action buttons" : item.label}
              onClick={() => onAddBlock(item.type)}
              onDragStart={(event) => {
                if (disabled) return;
                event.dataTransfer.setData(TEMPLATE_BLOCK_DND_MIME, item.type);
                event.dataTransfer.effectAllowed = "copy";
              }}
            >
              <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
