import { ACTION_LABELS, TRIGGER_LABELS } from "../constants";
import type { Skill, SkillLifecycleAction } from "../types";
import SkillActionsMenu from "./SkillActionsMenu";
import SkillStatusBadge from "./SkillStatusBadge";
import SkillTypeIcon from "./SkillTypeIcon";

type Props = {
  rows: Skill[];
  loading: boolean;
  error: string | null;
  queryNameById?: Record<string, string>;
  onOpenSkill: (skill: Skill) => void;
  onAction: (skill: Skill, action: SkillLifecycleAction) => void;
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return value;
  return new Date(ts).toLocaleString();
}

function triggerText(skill: Skill): string {
  return TRIGGER_LABELS[skill.trigger.type] ?? skill.trigger.type;
}

function actionText(skill: Skill): string {
  if (!skill.actions.length) return "-";
  if (skill.actions.length === 1) return ACTION_LABELS[skill.actions[0].type] ?? skill.actions[0].label;
  return `${skill.actions.length} actions`;
}

function resolveQueryLabel(skill: Skill, queryNameById?: Record<string, string>): string {
  if (skill.queryName && skill.queryName.trim()) return skill.queryName.trim();
  if (skill.queryId && queryNameById?.[skill.queryId]) return queryNameById[skill.queryId];
  if (skill.queryId) return `Linked (${skill.queryId.slice(0, 8)})`;
  return "Unlinked query";
}

export default function SkillsList({
  rows,
  loading,
  error,
  queryNameById,
  onOpenSkill,
  onAction,
}: Props) {
  if (loading) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body text-muted">Loading skills...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  if (!rows.length) {
    return null;
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="table-responsive">
        <table className="table align-middle mb-0 skills-table" aria-label="Skills table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Query</th>
              <th>Trigger</th>
              <th>Actions</th>
              <th>Status</th>
              <th>Last Run</th>
              <th>Updated At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((skill) => (
              <tr key={skill.id} onClick={() => onOpenSkill(skill)} style={{ cursor: "pointer" }}>
                <td>
                  <div className="d-flex align-items-center gap-2">
                    <SkillTypeIcon skillType={skill.skillType} className="text-muted" />
                    <div>
                      <div className="fw-semibold">{skill.name}</div>
                      <div className="small text-muted">{skill.skillType.replaceAll("_", " ")}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="fw-semibold">{resolveQueryLabel(skill, queryNameById)}</div>
                  <div className="small text-muted">{skill.queryId || "-"}</div>
                </td>
                <td>{triggerText(skill)}</td>
                <td>{actionText(skill)}</td>
                <td>
                  <SkillStatusBadge status={skill.status} />
                </td>
                <td>{formatDate(skill.lastRunAt)}</td>
                <td>{formatDate(skill.updatedAt)}</td>
                <td onClick={(event) => event.stopPropagation()}>
                  <SkillActionsMenu skill={skill} onAction={onAction} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
