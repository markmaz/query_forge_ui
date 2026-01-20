import { useDispatch } from "react-redux";
import { AppDispatch } from "../../../app/providers/store";
import { useAppSelector } from "../../../shared/lib/hooks";
import { fetchUserWorkspaceDetail, updateUserDefaultWorkspace } from "../model/settingsSlice";
import { useEffect, useState } from "react";
import { RootState } from "../../../app/providers/store";
import { toast } from 'react-toastify';
import './settings.css';

const UserWorkSpaceSettings = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { user } = useAppSelector((state) => state.user);
    const { workspaces, loading } = useAppSelector((state : RootState) => state.userWorkspaces);
  
    const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  
    useEffect(() => {
      const token = localStorage.getItem("Token");
      if (token) {
        dispatch(fetchUserWorkspaceDetail(token));
      }
    }, [dispatch]);
  
    useEffect(() => {
      const defaultWs = workspaces?.find((w) => w.is_default === 1);
      if (defaultWs) {
        setSelectedWorkspace(defaultWs.workspace_id);
      }
    }, [workspaces]);
  
    const handleSelect = async (workspaceId: string) => {
        setSelectedWorkspace(workspaceId);
        try {
        await dispatch(updateUserDefaultWorkspace({workspace_id: workspaceId }));
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
              {workspaces?.map((workspace) => (
                <tr key={workspace.workspace_id}>
                  <td className="align-middle px-3 text-center">
                    <input
                      type="radio"
                      name="defaultWorkspace"
                      checked={selectedWorkspace === workspace.workspace_id}
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
