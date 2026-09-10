import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * 🏪 Self-Service Shop Application Creation
 *
 * Allows authenticated users to apply to create a shop.
 * Creates the shop document in PENDING_REVIEW status with rate limiting and schema validation.
 * Prevents unauthorized users from creating immediately ACTIVE shops.
 */
export async function handleCreateShopApplication(db, request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "AUTHENTICATION_REQUIRED: กรุณาเข้าสู่ระบบก่อนสมัครเปิดร้านค้า");
  }

  const callerUid = request.auth.uid;
  const { name, description, location, contactPhone, operatingHours, maxOrdersPerSlot = 20 } = request.data || {};

  if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
    throw new HttpsError("invalid-argument", "INVALID_SHOP_NAME: ชื่อร้านค้าต้องมีความยาวระหว่าง 2 ถึง 100 ตัวอักษร");
  }
  if (!contactPhone || typeof contactPhone !== "string" || !/^[0-9]{9,10}$/.test(contactPhone.replace(/[-\s]/g, ""))) {
    throw new HttpsError("invalid-argument", "INVALID_PHONE: กรุณาระบุเบอร์โทรศัพท์ติดต่อที่ถูกต้อง");
  }

  // Rate Limiting: Check if user already has a pending application
  const existingQuery = await db.collection("shops")
    .where("ownerUid", "==", callerUid)
    .where("status", "==", "PENDING_REVIEW")
    .limit(1)
    .get();

  if (!existingQuery.empty) {
    throw new HttpsError("failed-precondition", "PENDING_APPLICATION_EXISTS: คุณมีคำขอเปิดร้านค้าที่รอการตรวจสอบอยู่แล้ว");
  }

  const shopRef = db.collection("shops").doc();
  const shopPayload = {
    id: shopRef.id,
    storeId: shopRef.id,
    ownerUid: callerUid,
    name: name.trim(),
    description: typeof description === "string" ? description.slice(0, 500) : "",
    location: typeof location === "string" ? location.slice(0, 200) : "โรงอาหารกลาง มข.",
    contactPhone: contactPhone.trim(),
    status: "PENDING_REVIEW", // Gated: Cannot be ACTIVE until reviewed
    isOpen: false,
    rating: 5.0,
    reviewsCount: 0,
    maxOrdersPerSlot: Math.max(1, Math.min(100, Number(maxOrdersPerSlot) || 20)),
    operatingHours: operatingHours || {
      monday: { isOpen: true, open: "08:00", close: "17:00" },
      tuesday: { isOpen: true, open: "08:00", close: "17:00" },
      wednesday: { isOpen: true, open: "08:00", close: "17:00" },
      thursday: { isOpen: true, open: "08:00", close: "17:00" },
      friday: { isOpen: true, open: "08:00", close: "17:00" },
      saturday: { isOpen: false },
      sunday: { isOpen: false },
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await shopRef.set(shopPayload);

  // Append Audit Record
  await db.collection("audit_logs").add({
    action: "SHOP_APPLICATION_SUBMITTED",
    storeId: shopRef.id,
    ownerUid: callerUid,
    timestamp: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    storeId: shopRef.id,
    status: "PENDING_REVIEW",
    message: "ส่งคำขอเปิดร้านค้าเรียบร้อยแล้ว รอการอนุมัติจากเจ้าหน้าที่โรงเรียน/มหาวิทยาลัย",
  };
}

/**
 * 👑 Review Shop Application (Staff / Admin Only)
 */
export async function handleReviewShopApplication(db, authAdmin, request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "AUTHENTICATION_REQUIRED");
  }

  const isAdmin = request.auth.token?.admin === true || request.auth.token?.role === "admin";
  const isSupervisor = request.auth.token?.staff_supervisor === true || request.auth.token?.role === "staff_supervisor";
  if (!isAdmin && !isSupervisor) {
    throw new HttpsError("permission-denied", "PERMISSION_DENIED: เฉพาะผู้ดูแลระบบหรือเจ้าหน้าที่เท่านั้น");
  }

  const { storeId, decision, reason } = request.data || {};
  if (!storeId || !["ACTIVE", "REJECTED"].includes(decision)) {
    throw new HttpsError("invalid-argument", "INVALID_ARGUMENTS: storeId and decision (ACTIVE/REJECTED) required");
  }

  const shopRef = db.collection("shops").doc(storeId);
  const shopSnap = await shopRef.get();
  if (!shopSnap.exists) {
    throw new HttpsError("not-found", "STORE_NOT_FOUND");
  }

  const shopData = shopSnap.data();
  const ownerUid = shopData.ownerUid;

  await shopRef.update({
    status: decision,
    isOpen: decision === "ACTIVE",
    reviewedBy: request.auth.uid,
    reviewedAt: FieldValue.serverTimestamp(),
    reviewReason: typeof reason === "string" ? reason.slice(0, 500) : "",
    updatedAt: FieldValue.serverTimestamp(),
  });

  // If approved, grant merchant claim to user if possible
  if (decision === "ACTIVE" && ownerUid && authAdmin) {
    try {
      const user = await authAdmin.getUser(ownerUid);
      const currentClaims = user.customClaims || {};
      const roles = Array.isArray(currentClaims.roles) ? currentClaims.roles : [];
      if (!roles.includes("merchant")) {
        roles.push("merchant");
      }
      await authAdmin.setCustomUserClaims(ownerUid, {
        ...currentClaims,
        roles,
        merchant: true,
        storeId,
      });
    } catch (claimErr) {
      console.warn("Could not set merchant custom claim:", claimErr);
    }
  }

  return {
    success: true,
    storeId,
    status: decision,
  };
}
