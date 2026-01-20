import { RouterProvider } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import router from "./app/routes/router"
import AuthBootstrap from "./app/providers/AuthBootstrap";

const App = () => {
  return (
    <AuthBootstrap>
      <RouterProvider router={router} />
      <ToastContainer />
    </AuthBootstrap>
    
  );
};

export default App;
