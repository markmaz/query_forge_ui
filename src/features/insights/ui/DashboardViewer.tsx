
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { fetchIframeUrl } from "../model/dashboardEmbedSlice";
import { useAppDispatch, useAppSelector } from "../../../shared/runtime/hooks";

const DashboardViewer = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();

  // Get URL, loading, and error state from Redux store
  const { url, loading, error } = useAppSelector((state) => state.embedUrl);

  useEffect(() => {
    if (id) {
      dispatch(fetchIframeUrl(id));
    }
  }, [id, dispatch]);

  const frameTitle = id ? `Dashboard ${id}` : "Dashboard";

  return (
    <div style={{ height: "100vh", width: "100%", display: "flex", flexDirection: "column" }}>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {url && (
        <iframe
          src={url}
          width="100%"
          height="100%"
          style={{ border: "none" }}
          title={frameTitle}
        />
      )}
    </div>
  );
};

export default DashboardViewer;
