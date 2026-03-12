import type { PipelineProfile } from "@/features/system-admin/types";
import StepChart from "./StepChart";
import AdminChartCard from "@/features/admin/charts/AdminChartCard";

interface ProfileDetailProps {
  profile: PipelineProfile;
}

export default function ProfileDetail({ profile }: ProfileDetailProps) {
  return (
    <div className="sa-detail-content">
      <div className="sa-detail-meta">
        <div className="sa-detail-meta-item">
          <span className="label">Trace ID</span>{" "}
          <span className="value">{profile.trace_id}</span>
        </div>
        <div className="sa-detail-meta-item">
          <span className="label">Workspace</span>{" "}
          <span className="value">{profile.workspace_id}</span>
        </div>
        <div className="sa-detail-meta-item">
          <span className="label">User</span>{" "}
          <span className="value">{profile.user_id}</span>
        </div>
        <div className="sa-detail-meta-item">
          <span className="label">Conversation</span>{" "}
          <span className="value">{profile.conversation_id}</span>
        </div>
      </div>

      <AdminChartCard
        title={
          <span>
            <i className="fa fa-comment" style={{ marginRight: 6 }} />
            Prompt
          </span>
        }
      >
        <p style={{ margin: 0, fontSize: "0.88rem", whiteSpace: "pre-wrap" }}>
          {profile.prompt}
        </p>
      </AdminChartCard>

      <StepChart steps={profile.steps} totalMs={profile.total_ms} />
    </div>
  );
}
