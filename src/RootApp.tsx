import { RouterProvider } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import router from "./app/navigation/router";
import AuthBootstrap from "./app/core/AuthBootstrap";

const App = () => {
  return (
    <AuthBootstrap>
      <RouterProvider router={router} />
      <ToastContainer />
    </AuthBootstrap>
  );
};

export default App;
