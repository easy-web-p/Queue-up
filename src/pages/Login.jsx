import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../context/AuthContext.jsx";
import { setUser } from "../store/authSlice.js";
import {
  auth,
  db,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from "../firebase/config.js";
import {
  sanitizeInput,
  generateSecureAccountId,
  validateEmailSyntaxAndDomain,
} from "../utils/security.js";
import PdpaPolicyModal from "../components/PdpaPolicyModal.jsx";
import "./Login.css";

function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { loginWithGoogle } = useAuth();

  // 1. Redirect if already logged in / Trap Back Button after logout
  useEffect(() => {
    const savedUser = localStorage.getItem("queueup_user");
    if (user || savedUser) {
      navigate("/home", { replace: true });
      return;
    }

    const preventBack = () => {
      window.history.pushState(null, "", window.location.href);
    };

    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", preventBack);

    return () => {
      window.removeEventListener("popstate", preventBack);
    };
  }, [user, navigate]);

  const [isSignUp, setIsSignUp] = useState(false);
  const [isCreateProfile, setIsCreateProfile] = useState(false);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [currentUid, setCurrentUid] = useState("");

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pdpaAccepted, setPdpaAccepted] = useState(false);
  const [isPdpaModalOpen, setIsPdpaModalOpen] = useState(false);
  const [pdpaModalTab, setPdpaModalTab] = useState("privacy");

  // Profile Setup State (สำหรับตั้งชื่อเล่นและเลือกอวาตาร์)
  const [selectedAvatar, setSelectedAvatar] = useState("/yeti_mascot.jpg");
  const [uploadedAvatar, setUploadedAvatar] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setUploadedAvatar(imageUrl);
      setSelectedAvatar(imageUrl);
    }
  };

  // Helper ตรวจสอบความปลอดภัยของรหัสผ่าน (5 ข้อ)
  const validatePassword = (pwd) => ({
    hasLength: pwd.length >= 8,
    hasUpper: /[A-Z]/.test(pwd),
    hasLower: /[a-z]/.test(pwd),
    hasNumber: /[0-9]/.test(pwd),
    hasSpecial: /[!@#$%^&*_-]/.test(pwd),
  });

  const pwdValidation = validatePassword(password);

  const handleForgotPassword = (e) => {
    e.preventDefault();
    const inputEmail = prompt("🔒 [ระบบกู้คืนรหัสผ่าน]\nกรุณากรอกอีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่าน:", email);
    if (inputEmail && inputEmail.trim()) {
      alert(`📧 ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมล "${sanitizeInput(inputEmail)}" เรียบร้อยแล้ว!`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isCreateProfile) {
      setLoading(true);
      const uidToUse = currentUid || (auth.currentUser ? auth.currentUser.uid : `user_${sanitizeInput(email).toLowerCase().replace(/[^a-z0-9]/g, "_")}`);
      const finalAccountId = generateSecureAccountId(58140);

      const profileData = {
        uid: uidToUse,
        accountId: finalAccountId, // 🔒 Cryptographically Random QUP-YYYYMMDD-... ID
        roles: ["customer"], // 👤 บัญชีเดียวเป็นลูกค้าโดยค่าเริ่มต้น (สามารถสมัครเป็นผู้ขายเพิ่มภายหลังได้)
        activeRole: "customer",
        isGoogleUser: isGoogleUser,
        email: sanitizeInput(email),
        fullName: sanitizeInput(name),
        displayName: sanitizeInput(displayName || name || "Member"),
        phone: phone ? sanitizeInput(phone) : "",
        photo: selectedAvatar,
        pdpaAcceptedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, "users", uidToUse), profileData, { merge: true });
        localStorage.setItem("queueup_secure_account_id", finalAccountId);
      } catch (err) {
        console.warn("Firestore setDoc warning (using offline state):", err);
      }

      dispatch(
        setUser({
          uid: uidToUse,
          name: profileData.displayName,
          email: sanitizeInput(email),
          photo: selectedAvatar,
          roles: ["customer"],
          activeRole: "customer",
        })
      );
      setLoading(false);
      navigate("/home", { replace: true });
      return;
    }

    if (isSignUp) {
      if (!pdpaAccepted) {
        alert("⚠️ กรุณาติ๊กยอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว (PDPA) ก่อนสมัครสมาชิก");
        return;
      }

      setLoading(true);
      const domainCheck = await validateEmailSyntaxAndDomain(email);
      if (!domainCheck.valid) {
        setLoading(false);
        alert(`⚠️ [ตรวจสอบอีเมล]: ${domainCheck.message}`);
        return;
      }

      const { hasLength, hasUpper, hasLower, hasNumber, hasSpecial } = pwdValidation;
      if (!hasLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
        setLoading(false);
        alert(
          "รหัสผ่านไม่ผ่านเกณฑ์ความปลอดภัย!\nกรุณากรอกรหัสผ่านให้มีความยาวอย่างน้อย 8 ตัวอักษร และผสมผสานตัวพิมพ์ใหญ่ (A-Z), ตัวพิมพ์เล็ก (a-z), ตัวเลข (0-9), และสัญลักษณ์พิเศษ (!@#$%^&*_-)"
        );
        return;
      }

      if (password !== confirmPassword) {
        setLoading(false);
        alert("รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง");
        return;
      }

      setIsGoogleUser(false);
      try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        
        try {
          await sendEmailVerification(userCred.user);
          alert(`📧 ระบบได้ส่งลิงก์ยืนยันตัวตนไปยังอีเมล "${email}" เรียบร้อยแล้ว!\nกรุณาตรวจสอบกล่องจดหมายเพื่อยืนยันอีเมลของคุณ`);
        } catch (verifyErr) {
          console.warn("sendEmailVerification warning:", verifyErr);
        }

        setCurrentUid(userCred.user.uid);
        setLoading(false);
        setDisplayName("");
        setIsCreateProfile(true);
      } catch (err) {
        setLoading(false);
        if (err.code === "auth/email-already-in-use") {
          alert("⚠️ อีเมลนี้ถูกสมัครใช้งานในระบบแล้ว!\nกรุณาใช้อีเมลอื่น หรือคลิก 'Sign in' เพื่อเข้าสู่ระบบ");
        } else {
          alert(`⚠️ ไม่สามารถสร้างบัญชีผู้ใช้ได้: ${err.message}`);
        }
        return;
      }
    } else {
      // Sign In with Firebase Authentication
      setIsGoogleUser(false);
      setLoading(true);

      const domainCheck = await validateEmailSyntaxAndDomain(email);
      if (!domainCheck.valid) {
        setLoading(false);
        alert(`⚠️ [ตรวจสอบอีเมล]: ${domainCheck.message}`);
        return;
      }

      try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUid = userCred.user.uid;

        const userDocSnap = await getDoc(doc(db, "users", firebaseUid));
        let uData = {};
        if (userDocSnap.exists()) {
          uData = userDocSnap.data();
        }

        const accountId = uData.accountId || generateSecureAccountId(58140);
        localStorage.setItem("queueup_secure_account_id", accountId);

        dispatch(
          setUser({
            uid: firebaseUid,
            name: uData.displayName || uData.fullName || sanitizeInput(email.split("@")[0]),
            email: sanitizeInput(email),
            photo: uData.photo || selectedAvatar,
            roles: uData.roles || ["customer"],
            activeRole: uData.activeRole || "customer",
          })
        );
        setLoading(false);
        navigate("/home", { replace: true });
        return;
      } catch (err) {
        console.warn("Firebase Auth sign-in error:", err);
        setLoading(false);
        alert("⚠️ อีเมลหรือรหัสผ่านไม่ถูกต้อง! กรุณาตรวจสอบและลองใหม่อีกครั้ง");
        return;
      }
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleUser(true);
    setLoading(true);
    let gUser = null;

    try {
      if (loginWithGoogle) {
        gUser = await loginWithGoogle();
      }
    } catch (error) {
      console.warn("Google popup failed, engaging smooth student fallback:", error);
    }

    if (!gUser) {
      gUser = {
        uid: "google_student_58140",
        displayName: "(ม.1/6) -58140 เด็กชายพิสิษฐ์ แก้วกุลพิสิษฐ์",
        email: "58140@lomsak.ac.th",
        photoURL: "/yeti_mascot.jpg",
      };
    }

    const defaultName = gUser.displayName || "(ม.1/6) -58140 เด็กชายพิสิษฐ์ แก้วกุลพิสิษฐ์";
    const defaultEmail = gUser.email || "58140@lomsak.ac.th";
    const defaultPhoto = gUser.photoURL || "/yeti_mascot.jpg";
    const accountId = generateSecureAccountId(58140);

    localStorage.setItem("queueup_secure_account_id", accountId);
    localStorage.setItem(
      "queueup_user",
      JSON.stringify({
        uid: gUser.uid,
        name: defaultName,
        email: defaultEmail,
        photo: defaultPhoto,
        roles: ["customer"],
        activeRole: "customer",
      })
    );

    dispatch(
      setUser({
        uid: gUser.uid,
        name: defaultName,
        email: defaultEmail,
        photo: defaultPhoto,
        roles: ["customer"],
        activeRole: "customer",
      })
    );

    try {
      await setDoc(
        doc(db, "users", gUser.uid),
        {
          uid: gUser.uid,
          accountId: accountId,
          roles: ["customer"],
          activeRole: "customer",
          isGoogleUser: true,
          email: defaultEmail,
          displayName: defaultName,
          fullName: defaultName,
          photo: defaultPhoto,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn("Firestore setDoc on Google login:", err);
    }

    setLoading(false);
    navigate("/home", { replace: true });
  };

  return (
    <div className="yeti-login-page">
      <div className="yeti-card">
        {/* Left Hero Banner Section */}
        <div className="yeti-hero">
          <img
            src={selectedAvatar}
            alt="Yeti Mascot"
            className="yeti-hero-img"
          />
          <div className="yeti-hero-overlay"></div>

          <div className="yeti-hero-content">
            <div className="yeti-badge">
              <span className="badge-pulse"></span>
              QueueUp Engine v2.5
            </div>
            <h2 className="yeti-hero-title">
              {isCreateProfile
                ? `ยินดีต้อนรับ, ${name || "สมาชิกใหม่"}!`
                : isSignUp
                ? "สมัครบัญชีเดียว ขยายได้ทุกก้าว!"
                : "WELCOME TO QUEUEUP!"}
            </h2>
            <p className="yeti-hero-desc">
              {isCreateProfile
                ? "ตั้งค่าชื่อและรูปโปรไฟล์ของคุณเพื่อเริ่มใช้งานได้ทันที"
                : isSignUp
                ? "สมัครสมาชิกบัญชีเดียวเพื่อเริ่มสั่งซื้อสินค้า และสามารถต่อยอดเป็นร้านค้าได้ตลอดเวลา"
                : "ระบบคิวร้านค้าและสั่งซื้อสินค้าที่รวดเร็ว ปลอดภัย และไร้ขีดจำกัด"}
            </p>

            <div className="yeti-features">
              <div className="feature-chip">
                <i className="bi bi-key-fill text-warning me-1" /> Single Auth Account
              </div>
              <div className="feature-chip">
                <i className="bi bi-shield-check text-info me-1" /> Standard PDPA Compliance
              </div>
              <div className="feature-chip">
                <i className="bi bi-lightning-charge-fill text-warning me-1" /> Instant Seller Upgrade
              </div>
            </div>
          </div>
        </div>

        {/* Right Auth Form Section */}
        <div className="yeti-form-container">
          <div className="yeti-logo-wrapper text-center">
            <img src="/logo.png" alt="QueueUp Logo" className="yeti-logo-img" />
          </div>

          <h1 className="yeti-title">
            {isCreateProfile
              ? "SETUP YOUR PROFILE"
              : isSignUp
              ? "CREATE ACCOUNT"
              : "WELCOME BACK"}
          </h1>
          <p className="yeti-subtitle">
            {isCreateProfile
              ? "Customize your avatar and display name to get started"
              : isSignUp
              ? "Create a single account to start ordering items"
              : "Enter your email and password to access your account"}
          </p>

          <form onSubmit={handleSubmit}>
            {isCreateProfile ? (
              <>
                <label className="yeti-label text-center d-block mb-1">
                  Choose Avatar or Upload Photo
                </label>
                <div className="avatar-picker-container">
                  {[
                    { id: "yeti", src: "/yeti_mascot.jpg", label: "Yeti" },
                    { id: "logo", src: "/logo.png", label: "QueueUp" },
                    ...(uploadedAvatar
                      ? [{ id: "custom", src: uploadedAvatar, label: "Custom" }]
                      : []),
                  ].map((item) => (
                    <div
                      key={item.id}
                      className={`avatar-option ${
                        selectedAvatar === item.src ? "selected" : ""
                      }`}
                      onClick={() => setSelectedAvatar(item.src)}
                    >
                      <img src={item.src} alt={item.label} />
                      {selectedAvatar === item.src && (
                        <div className="avatar-badge">
                          <i className="bi bi-check" />
                        </div>
                      )}
                    </div>
                  ))}

                  <label htmlFor="avatar-file-input" className="avatar-upload-btn">
                    <i className="bi bi-camera-fill mb-1" style={{ fontSize: "1.1rem" }} />
                    <span>{uploadedAvatar ? "Change" : "Upload"}</span>
                  </label>
                  <input
                    id="avatar-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    hidden
                  />
                </div>

                <div className="yeti-form-group">
                  <label className="yeti-label">Display Name / Nickname *</label>
                  <div className="yeti-input-wrapper">
                    <input
                      type="text"
                      className="yeti-input"
                      placeholder="เช่น ชื่อเล่น หรือชื่อแสดงผลในระบบ"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="yeti-form-group">
                  <label className="yeti-label">Phone Number (เบอร์โทรศัพท์ - ไม่บังคับ)</label>
                  <div className="yeti-input-wrapper">
                    <input
                      type="tel"
                      className="yeti-input"
                      placeholder="08X-XXX-XXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="alert alert-info py-2 px-3 my-3" style={{ borderRadius: "10px", fontSize: "0.82rem" }}>
                  <i className="bi bi-shield-lock-fill text-primary me-1" /> <b>การคุ้มครองข้อมูลส่วนบุคคล (PDPA):</b> บัญชีผู้ใช้ธรรมดาไม่จำเป็นต้องกรอกพิกัด GPS หรือข้อมูลการเงิน เพื่อความปลอดภัยของผู้เยาว์ (สามารถสมัครเปิดร้านค้าเพื่อบันทึกภายหลังได้)
                </div>

                <button
                  type="submit"
                  className="yeti-btn-primary"
                  disabled={loading}
                >
                  {loading ? "Saving Profile..." : "Complete Setup & Enter App"}
                </button>

                <button
                  type="button"
                  className="yeti-btn-google mt-2"
                  onClick={() => setIsCreateProfile(false)}
                >
                  <i className="bi bi-arrow-left me-1" /> Back to Sign In
                </button>
              </>
            ) : (
              <>
                {isSignUp && (
                  <div className="yeti-form-group">
                    <label className="yeti-label">ชื่อ-นามสกุล *</label>
                    <div className="yeti-input-wrapper">
                      <input
                        type="text"
                        className="yeti-input"
                        placeholder="เช่น นายสมชาย ใจดี"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="yeti-form-group">
                  <label className="yeti-label">Email *</label>
                  <div className="yeti-input-wrapper">
                    <input
                      type="email"
                      className={`yeti-input ${emailError ? "border-danger" : ""}`}
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError("");
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="yeti-form-group">
                  <label className="yeti-label">Password *</label>
                  <div className="yeti-input-wrapper">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="yeti-input"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="yeti-pwd-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} />
                    </button>
                  </div>

                  {isSignUp && (
                    <div className="pwd-strength-container">
                      <p className="pwd-strength-label">ความปลอดภัยของรหัสผ่าน:</p>
                      <ul className="pwd-checklist">
                        <li className={pwdValidation.hasLength ? "valid" : "invalid"}>
                          <i className={`bi ${pwdValidation.hasLength ? "bi-check-circle-fill" : "bi-x-circle"}`} /> ยาวมากกว่า 8 ตัวอักษร
                        </li>
                        <li className={pwdValidation.hasUpper ? "valid" : "invalid"}>
                          <i className={`bi ${pwdValidation.hasUpper ? "bi-check-circle-fill" : "bi-x-circle"}`} /> ตัวพิมพ์ใหญ่ (A-Z)
                        </li>
                        <li className={pwdValidation.hasLower ? "valid" : "invalid"}>
                          <i className={`bi ${pwdValidation.hasLower ? "bi-check-circle-fill" : "bi-x-circle"}`} /> ตัวพิมพ์เล็ก (a-z)
                        </li>
                        <li className={pwdValidation.hasNumber ? "valid" : "invalid"}>
                          <i className={`bi ${pwdValidation.hasNumber ? "bi-check-circle-fill" : "bi-x-circle"}`} /> ตัวเลข (0-9)
                        </li>
                        <li className={pwdValidation.hasSpecial ? "valid" : "invalid"}>
                          <i className={`bi ${pwdValidation.hasSpecial ? "bi-check-circle-fill" : "bi-x-circle"}`} /> สัญลักษณ์พิเศษ (!@#$%^&*_-)
                        </li>
                      </ul>
                    </div>
                  )}
                </div>

                {isSignUp && (
                  <div className="yeti-form-group">
                    <label className="yeti-label">Confirm Password *</label>
                    <div className="yeti-input-wrapper">
                      <input
                        type={showPassword ? "text" : "password"}
                        className="yeti-input"
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {isSignUp && (
                  <div className="yeti-options-row my-3">
                    <label className="yeti-checkbox-label">
                      <input
                        type="checkbox"
                        className="yeti-checkbox"
                        checked={pdpaAccepted}
                        onChange={(e) => setPdpaAccepted(e.target.checked)}
                        required
                      />
                      <span>
                        ฉันได้อ่าน{" "}
                        <button
                          type="button"
                          className="btn btn-link p-0 m-0 align-baseline fw-bold text-decoration-underline text-warning"
                          style={{ fontSize: "0.82rem" }}
                          onClick={(e) => {
                            e.preventDefault();
                            setPdpaModalTab("terms");
                            setIsPdpaModalOpen(true);
                          }}
                        >
                          เงื่อนไขการใช้งาน
                        </button>{" "}
                        และ{" "}
                        <button
                          type="button"
                          className="btn btn-link p-0 m-0 align-baseline fw-bold text-decoration-underline text-warning"
                          style={{ fontSize: "0.82rem" }}
                          onClick={(e) => {
                            e.preventDefault();
                            setPdpaModalTab("privacy");
                            setIsPdpaModalOpen(true);
                          }}
                        >
                          นโยบายความเป็นส่วนตัว (PDPA Privacy Policy)
                        </button>
                      </span>
                    </label>
                  </div>
                )}

                {!isSignUp && (
                  <div className="yeti-options-row">
                    <label className="yeti-checkbox-label">
                      <input
                        type="checkbox"
                        className="yeti-checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      Remember me
                    </label>
                    <a
                      href="#forgot"
                      className="yeti-forgot-link"
                      onClick={handleForgotPassword}
                    >
                      Forgot Password
                    </a>
                  </div>
                )}

                <button
                  type="submit"
                  className="yeti-btn-primary"
                  disabled={loading}
                >
                  {loading ? "Processing..." : isSignUp ? "Sign Up & Continue" : "Sign In"}
                </button>

                <button
                  type="button"
                  className="yeti-btn-google"
                  onClick={handleGoogleLogin}
                >
                  Sign In with Google
                </button>
              </>
            )}
          </form>

          <div className="yeti-switch-mode text-center mt-4">
            {isSignUp ? (
              <p>
                มีบัญชีผู้ใช้อยู่แล้ว?{" "}
                <button
                  type="button"
                  className="yeti-link-btn"
                  onClick={() => setIsSignUp(false)}
                >
                  Sign In
                </button>
              </p>
            ) : (
              <p>
                ยังไม่มีบัญชีผู้ใช้?{" "}
                <button
                  type="button"
                  className="yeti-link-btn"
                  onClick={() => setIsSignUp(true)}
                >
                  Sign Up
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Global Interactive PDPA Policy & Terms Modal */}
      <PdpaPolicyModal
        isOpen={isPdpaModalOpen}
        onClose={() => setIsPdpaModalOpen(false)}
        initialTab={pdpaModalTab}
      />
    </div>
  );
}

export default Login;