import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function UserPurchase() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/user/account/profile?tab=bookings", { replace: true });
  }, [navigate]);

  return null;
}

export default UserPurchase;
