import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import Loading from "../pages/Loading.jsx";

/**
 * PROTECTED ROUTE GUARD
 * Enforces strict authentication for private pages (/home, /user/purchase, /user/account/profile)
 * Prevents white screen flashes and handles unauthenticated redirects smoothly.
 */
export default function ProtectedRoute({ children }) {
  const { user, isLoading } = useSelector((state) => state.auth);
  const savedUser = localStorage.getItem("queueup_user");

  if (isLoading) {
    return <Loading />;
  }

  if (!user && !savedUser) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
