import { useEffect } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

/**
 * PROTECTED ROUTE GUARD
 * Enforces strict authentication for private pages (/home, /user/purchase, /user/account/profile)
 * Prevents unauthorized back-button navigation after logout.
 */
export default function ProtectedRoute({ children }) {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = localStorage.getItem("queueup_user");
    if (!user && !savedUser) {
      navigate("/login", { replace: true });
    }
  }, [user, navigate]);

  const savedUser = localStorage.getItem("queueup_user");
  if (!user && !savedUser) {
    return null; // Return empty void so no user content flashes
  }

  return children;
}
