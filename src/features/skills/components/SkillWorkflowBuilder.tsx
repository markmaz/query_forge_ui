import { useState } from "react";
import {
  ACTION_LABELS,
  CONDITION_LABELS,
  TRIGGER_LABELS,
} from "../constants";
import type {
  SkillActionBlock,
  SkillActionType,
  SkillConditionBlock,
  SkillConditionType,
  SkillTriggerBlock,
  SkillTriggerType,
} from "../types";
import SkillBlockCard from "./SkillBlockCard";

type SelectedBlock =
  | { kind: "trigger"; id: string }
  | { kind: "condition"; id: string }
  | { kind: "action"; id: string }
  | null;

type Props = {
  trigger: SkillTriggerBlock;
  conditions: SkillConditionBlock[];
  actions: SkillActionBlock[];
  selectedBlock: SelectedBlock;
  expandedBlocks: Record<string, boolean>;
  onSelectBlock: (block: SelectedBlock) => void;
  onSetTriggerType: (type: SkillTriggerType) => void;
  onAddCondition: (type: SkillConditionType) => void;
  onAddAction: (type: SkillActionType) => void;
  onRemoveCondition: (id: string) => void;
  onRemoveAction: (id: string) => void;
  onMoveCondition: (id: string, direction: "up" | "down") => void;
  onMoveAction: (id: string, direction: "up" | "down") => void;
  onToggleExpanded: (id: string) => void;
};

export default function SkillWorkflowBuilder({
  trigger,
  conditions,
  actions,
  selectedBlock,
  expandedBlocks,
  onSelectBlock,
  onSetTriggerType,
  onAddCondition,
  onAddAction,
  onRemoveCondition,
  onRemoveAction,
  onMoveCondition,
  onMoveAction,
  onToggleExpanded,
}: Props) {
  const [newConditionType, setNewConditionType] = useState<SkillConditionType>("metric_threshold");
  const [newActionType, setNewActionType] = useState<SkillActionType>("email_report");

  return (
    <div>
      <div className="skills-workflow-header mb-2">
        <h3 className="h6 mb-1">Workflow</h3>
        <div className="small text-muted">WHEN → IF → THEN</div>
      </div>

      <div className="mb-3">
        <label className="form-label small text-muted">Trigger type</label>
        <select
          className="form-select form-select-sm"
          value={trigger.type}
          onChange={(event) => onSetTriggerType(event.target.value as SkillTriggerType)}
        >
          {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <SkillBlockCard
        block={trigger}
        selected={selectedBlock?.id === trigger.id}
        expanded={Boolean(expandedBlocks[trigger.id])}
        onSelect={() => onSelectBlock({ kind: "trigger", id: trigger.id })}
        onToggleExpanded={() => onToggleExpanded(trigger.id)}
      />

      <div className="skills-separator">IF</div>

      {conditions.map((condition, index) => (
        <SkillBlockCard
          key={condition.id}
          block={condition}
          selected={selectedBlock?.id === condition.id}
          expanded={Boolean(expandedBlocks[condition.id])}
          onSelect={() => onSelectBlock({ kind: "condition", id: condition.id })}
          onToggleExpanded={() => onToggleExpanded(condition.id)}
          onRemove={() => onRemoveCondition(condition.id)}
          onMoveUp={index > 0 ? () => onMoveCondition(condition.id, "up") : undefined}
          onMoveDown={
            index < conditions.length - 1 ? () => onMoveCondition(condition.id, "down") : undefined
          }
        />
      ))}

      <div className="skills-add-row">
        <select
          className="form-select form-select-sm"
          value={newConditionType}
          onChange={(event) => setNewConditionType(event.target.value as SkillConditionType)}
        >
          {Object.entries(CONDITION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onAddCondition(newConditionType)}>
          Add condition
        </button>
      </div>

      <div className="skills-separator">THEN</div>

      {actions.map((action, index) => (
        <SkillBlockCard
          key={action.id}
          block={action}
          selected={selectedBlock?.id === action.id}
          expanded={Boolean(expandedBlocks[action.id])}
          onSelect={() => onSelectBlock({ kind: "action", id: action.id })}
          onToggleExpanded={() => onToggleExpanded(action.id)}
          onRemove={() => onRemoveAction(action.id)}
          onMoveUp={index > 0 ? () => onMoveAction(action.id, "up") : undefined}
          onMoveDown={index < actions.length - 1 ? () => onMoveAction(action.id, "down") : undefined}
        />
      ))}

      <div className="skills-add-row">
        <select
          className="form-select form-select-sm"
          value={newActionType}
          onChange={(event) => setNewActionType(event.target.value as SkillActionType)}
        >
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onAddAction(newActionType)}>
          Add action
        </button>
      </div>
    </div>
  );
}
