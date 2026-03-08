import { useDispatch } from "react-redux";
import { AppDispatch } from "../../../app/core/store";
import { useAppSelector } from "../../../shared/runtime/hooks";
import {
  fetchUserWorkspaceDetail,
  setSelectedWorkspace,
  updateUserDefaultWorkspace,
} from "../model/settingsSlice";
import { useEffect } from "react";
import { RootState } from "../../../app/core/store";
import { toast } from 'react-toastify';
import './settings.css';

const UserWorkSpaceSettings = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { workspaces, loading, selectedWorkspaceId, loaded } = useAppSelector(
      (state: RootState) => state.userWorkspaces
    );
  
    useEffect(() => {
      if (!loaded) {
        dispatch(fetchUserWorkspaceDetail());
      }
    }, [dispatch, loaded]);
  
    const handleSelect = async (workspaceId: string) => {
        dispatch(setSelectedWorkspace(workspaceId));
        try {
          const result = await dispatch(updateUserDefaultWorkspace({ workspace_id: workspaceId }));
          if (updateUserDefaultWorkspace.rejected.match(result)) {
            toast.error("Invalid workspace selection.");
            return;
          }
          toast.success("Default workspace updated!");
        } catch (error) {
          toast.error("Failed to update workspace");
        }
      };
  
    if (loading) return <div>Loading workspaces...</div>;
  
    return (
        <div className="container mt-4">
        <h5 className="mb-3">Workspace Settings</h5>
        <div className="table-wrapper rounded shadow-sm">
          <table className="table table-hover custom-striped mb-0">
            <thead className="table-header">
              <tr>
                <th className="px-3"></th>
                <th className="px-3">Name</th>
                <th className="px-3">Workspace</th>
              </tr>
            </thead>
            <tbody>
              {workspaces?.map((workspace: { workspace_id: string; name: string; server: string }) => (
                <tr key={workspace.workspace_id}>
                  <td className="align-middle px-3 text-center">
                    <input
                      type="radio"
                      name="defaultWorkspace"
                      checked={selectedWorkspaceId === workspace.workspace_id}
                      onChange={() => handleSelect(workspace.workspace_id)}
                    />
                  </td>
                  <td className="align-middle px-3">{workspace.name}</td>
                  <td className="align-middle px-3">{workspace.server}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  
  export default UserWorkSpaceSettings;
