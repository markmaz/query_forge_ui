import type { DragEvent } from "react";

import type {
  FlowForgeCommunicationTemplateBlock,
  FlowForgeCommunicationTemplateBlockType,
} from "../model/communicationTemplateTypes";
import { labelFor } from "../model/communicationTemplateBuilder";
import type { PreviewBlock } from "../model/communicationTemplateBuilder";
import { TemplatePreview } from "./CommunicationTemplateBuilderPanels";
import { TEMPLATE_BLOCK_DND_MIME } from "./communicationTemplateDnd";

export default function CommunicationTemplatePreviewCanvas({
  subject,
  blocks,
  renderedBlocks,
  mode,
  selectedBlockIndex,
  onSubjectChange,
  onSelectBlock,
  onChangeBlock,
  onDropNewBlock,
  onMoveBlock,
}: {
  subject: string;
  blocks: FlowForgeCommunicationTemplateBlock[];
  renderedBlocks: PreviewBlock[];
  mode: "edit" | "preview";
  selectedBlockIndex: number;
  onSubjectChange: (value: string) => void;
  onSelectBlock: (index: number) => void;
  onChangeBlock: (index: number, block: FlowForgeCommunicationTemplateBlock) => void;
  onDropNewBlock: (type: FlowForgeCommunicationTemplateBlockType, index?: number) => void;
  onMoveBlock: (fromIndex: number, toIndex: number) => void;
}) {
  const onCanvasDragOver = (event: DragEvent<HTMLElement>) => {
    if (!Array.from(event.dataTransfer.types).includes(TEMPLATE_BLOCK_DND_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = event.dataTransfer.getData(TEMPLATE_BLOCK_DND_MIME).startsWith("move:") ? "move" : "copy";
  };
  const onDropAt = (event: DragEvent<HTMLElement>, index?: number) => {
    const value = event.dataTransfer.getData(TEMPLATE_BLOCK_DND_MIME);
    if (!value) return;
    event.preventDefault();
    if (value.startsWith("move:")) {
      const fromIndex = Number(value.replace("move:", ""));
      if (Number.isFinite(fromIndex)) onMoveBlock(fromIndex, index ?? blocks.length - 1);
      return;
    }
    onDropNewBlock(value as FlowForgeCommunicationTemplateBlockType, index);
  };

  if (mode === "preview") {
    return (
      <section className="ff-template-preview-center" aria-label="Delivered email preview">
        <TemplatePreview subject={subject} blocks={renderedBlocks} />
      </section>
    );
  }

  return (
    <section className="ff-template-preview-center is-editing" aria-label="Editable email preview" onDragOver={onCanvasDragOver} onDrop={(event) => onDropAt(event)}>
      <div className="ff-template-preview">
        <label className="ff-template-preview-subject is-editable">
          <span>Subject</span>
          <input value={subject} onChange={(event) => onSubjectChange(event.target.value)} />
        </label>
        <div className="ff-template-preview-body">
          {blocks.map((block, index) => (
            <EditablePreviewBlock
              key={`${block.type}-${index}`}
              block={block}
              index={index}
              selected={index === selectedBlockIndex}
              onDropAt={onDropAt}
              onSelect={() => onSelectBlock(index)}
              onChange={(nextBlock) => onChangeBlock(index, nextBlock)}
            />
          ))}
          <button type="button" className="ff-template-drop-zone" onDragOver={onCanvasDragOver} onDrop={(event) => onDropAt(event)} onClick={() => undefined}>
            Drop a block here
          </button>
        </div>
      </div>
    </section>
  );
}

function EditablePreviewBlock({
  block,
  index,
  selected,
  onDropAt,
  onSelect,
  onChange,
}: {
  block: FlowForgeCommunicationTemplateBlock;
  index: number;
  selected: boolean;
  onDropAt: (event: DragEvent<HTMLElement>, index?: number) => void;
  onSelect: () => void;
  onChange: (block: FlowForgeCommunicationTemplateBlock) => void;
}) {
  return (
    <article
      className={`ff-template-edit-block ${selected ? "is-selected" : ""}`}
      onClick={onSelect}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => onDropAt(event, index)}
    >
      <button
        type="button"
        className="ff-template-drag-handle"
        draggable
        aria-label={`Drag ${labelFor(block.type)} block`}
        onDragStart={(event) => {
          event.dataTransfer.setData(TEMPLATE_BLOCK_DND_MIME, `move:${index}`);
          event.dataTransfer.effectAllowed = "move";
        }}
      >
        <i className="fa-solid fa-grip-vertical" aria-hidden="true" />
      </button>
      <EditableBlockBody block={block} onChange={onChange} />
    </article>
  );
}

function EditableBlockBody({
  block,
  onChange,
}: {
  block: FlowForgeCommunicationTemplateBlock;
  onChange: (block: FlowForgeCommunicationTemplateBlock) => void;
}) {
  if (block.type === "heading") {
    return <input className="ff-template-inline-heading" value={block.content} onChange={(event) => onChange({ ...block, content: event.target.value })} />;
  }
  if (block.type === "text") {
    return <textarea className="ff-template-inline-text" value={block.content} rows={3} onChange={(event) => onChange({ ...block, content: event.target.value })} />;
  }
  if (block.type === "field_value") {
    return (
      <p>
        <strong>{block.label || block.field}:</strong> <span>{`{{${block.field}}}`}</span>
      </p>
    );
  }
  if (block.type === "field_list") {
    return (
      <ul>
        {block.fields.map((field) => (
          <li key={field}>{`{{${field}}}`}</li>
        ))}
      </ul>
    );
  }
  if (block.type === "image") {
    return block.src ? (
      <p className="ff-template-preview-image">
        <img src={block.src} alt={block.alt ?? ""} width={block.width ? Number(block.width) : 160} />
      </p>
    ) : (
      <button type="button" className="ff-template-image-placeholder" onClick={() => undefined}>
        Add image URL in details
      </button>
    );
  }
  if (block.type === "action_buttons") {
    return (
      <div className="ff-template-preview-actions">
        {block.actions.map((action) => (
          <span key={action}>{labelFor(action)}</span>
        ))}
      </div>
    );
  }
  return <hr />;
}
