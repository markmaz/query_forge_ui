import { useDispatch } from "react-redux";
import { AppDispatch } from "../../../app/core/store";
import { useAppSelector } from "../../../shared/runtime/hooks";
import {
  fetchUserWorkspaceDetail,
  updateUserDefaultWorkspace,
} from "../model/settingsSlice";
import { useEffect, useMemo, useState } from "react";
import { RootState } from "../../../app/core/store";
import { toast } from 'react-toastify';
import './settings.css';

const UserWorkSpaceSettings = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { workspaces, loading, error, selectedWorkspaceId, loaded } = useAppSelector(
      (state: RootState) => state.userWorkspaces
    );
    const [updatingWorkspaceId, setUpdatingWorkspaceId] = useState<string | null>(null);

    const defaultWorkspace = useMemo(
      () =>
        workspaces.find((workspace) => workspace.is_default === 1) ??
        (selectedWorkspaceId
          ? workspaces.find((workspace) => workspace.workspace_id === selectedWorkspaceId)
          : null) ??
        null,
      [selectedWorkspaceId, workspaces]
    );
  
    useEffect(() => {
      if (!loaded) {
        dispatch(fetchUserWorkspaceDetail());
      }
    }, [dispatch, loaded]);
  
    const handleSelect = async (workspaceId: string) => {
        if (workspaceId === defaultWorkspace?.workspace_id) {
          return;
        }

        setUpdatingWorkspaceId(workspaceId);
        try {
          const result = await dispatch(updateUserDefaultWorkspace({ workspace_id: workspaceId }));
          if (updateUserDefaultWorkspace.rejected.match(result)) {
            toast.error("Invalid workspace selection.");
            return;
          }
          toast.success("Default workspace updated!");
        } catch (error) {
          toast.error("Failed to update workspace");
        } finally {
          setUpdatingWorkspaceId(null);
        }
      };
  
    if (loading) {
      return (
        <div className="workspace-settings-loading">
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
          Loading assigned workspaces...
        </div>
      );
    }
  
    return (
      <section className="workspace-settings-panel mt-4">
        <header className="workspace-settings-header">
          <div>
            <h5 className="mb-1">Assigned Workspaces</h5>
            <p className="workspace-settings-subtitle mb-0">
              Your account is assigned to {workspaces.length} workspace{workspaces.length === 1 ? "" : "s"}.
              Choose one default workspace for query and planner actions.
            </p>
          </div>
          <span className="badge text-bg-light workspace-settings-count">{workspaces.length}</span>
        </header>

        <div className="workspace-default-card">
          <div className="workspace-default-label">Default workspace</div>
          <div className="workspace-default-name">{defaultWorkspace?.name ?? "No default workspace selected"}</div>
          <div className="workspace-default-server">{defaultWorkspace?.server ?? "Pick a workspace below."}</div>
        </div>

        {error ? <div className="alert alert-danger py-2">{error}</div> : null}

        <div className="table-wrapper rounded shadow-sm">
          <table className="table table-hover custom-striped mb-0">
            <thead className="table-header">
              <tr>
                <th className="px-3">Name</th>
                <th className="px-3">Workspace</th>
                <th className="px-3">Status</th>
                <th className="px-3 text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {!workspaces?.length ? (
                <tr>
                  <td className="align-middle px-3 text-muted" colSpan={4}>
                    No workspaces available.
                  </td>
                </tr>
              ) : null}
              {workspaces?.map((workspace: { workspace_id: string; name: string; server: string }) => (
                <tr key={workspace.workspace_id}>
                  <td className="align-middle px-3">{workspace.name}</td>
                  <td className="align-middle px-3">{workspace.server}</td>
                  <td className="align-middle px-3">
                    {workspace.workspace_id === defaultWorkspace?.workspace_id ? (
                      <span className="badge text-bg-primary">Default</span>
                    ) : (
                      <span className="badge text-bg-light">Assigned</span>
                    )}
                  </td>
                  <td className="align-middle px-3 text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary workspace-default-btn"
                      disabled={
                        workspace.workspace_id === defaultWorkspace?.workspace_id ||
                        updatingWorkspaceId === workspace.workspace_id
                      }
                      onClick={() => handleSelect(workspace.workspace_id)}
                    >
                      {updatingWorkspaceId === workspace.workspace_id ? "Saving..." : "Set as default"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  };
  
  export default UserWorkSpaceSettings;
