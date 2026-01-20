import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "./hooks";
import { logout } from "../../features/auth/model/authSlice";
import {jwtDecode} from "jwt-decode";
import { routes } from "../../app/routes/routes";

interface JwtPayload {
  exp: number;
}

const TokenWatcher = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("Token");
    if (!token || token.split(".").length !== 3) {
      console.log("No valid token found");
      return;
    }

    try {
      const decoded: JwtPayload = jwtDecode(token);
      const expiresInMs = decoded.exp * 1000 - Date.now();
      console.log("Token expires in ms:", expiresInMs);

      if (expiresInMs > 0) {
        const timer = setTimeout(() => {
          console.log("Token expired — logging out");
          dispatch(logout());
          navigate(routes.Auth);
        }, expiresInMs);

        return () => clearTimeout(timer);
      } else {
        console.log("Token already expired");
        dispatch(logout());
        navigate(routes.Auth);
      }
    } catch (err) {
      console.error("JWT decoding failed", err);
      dispatch(logout());
      navigate(routes.Auth);
    }
  }, [dispatch, navigate]);

  return null;
};

export default TokenWatcher;
