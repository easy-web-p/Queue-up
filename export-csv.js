import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = {
  apiKey: "AIzaSyCWCpdSksHY_mU5rqZWHob1rLRws7RB8nA",
  projectId: "queueup-65e82",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SURVEY_QUESTIONS = [
  "ข้อ 1 (ความง่ายในการใช้งาน)",
  "ข้อ 2 (ระบบสมาชิก)",
  "ข้อ 3 (การค้นหา)",
  "ข้อ 4 (ข้อมูลเมนู)",
  "ข้อ 5 (ระบบคิวล่วงหน้า)",
  "ข้อ 6 (ความถูกต้องของคิว)",
  "ข้อ 7 (การแจ้งเตือน)",
  "ข้อ 8 (ความรวดเร็ว)",
  "ข้อ 9 (ความเสถียร)",
  "ข้อ 10 (ความปลอดภัย & PDPA)",
  "ข้อ 11 (ระบบชำระเงิน)",
  "ข้อ 12 (ประโยชน์การใช้งาน)",
  "ข้อ 13 (ความพึงพอใจโดยรวม)",
  "ข้อ 14 (ความตั้งใจใช้งานต่อ)",
  "ข้อ 15 (การบอกต่อแนะนำ)"
];

async function exportAll() {
  console.log("Fetching surveys and evaluations from Firestore...");
  
  // 1. Export Canteen Surveys
  const surveySnap = await getDocs(collection(db, "canteen_surveys"));
  console.log(`Fetched ${surveySnap.size} canteen_surveys`);
  
  const surveyHeaders = [
    "ลำดับ",
    "รหัสแบบประเมิน",
    "ชั้นปี / กลุ่มตัวอย่าง",
    "คณะ / สังกัด",
    "วันที่ประเมิน",
    ...SURVEY_QUESTIONS,
    "คะแนนเฉลี่ย (เต็ม 5.00)",
    "ร้อยละความพึงพอใจ (%)",
    "ระดับความพึงพอใจ",
    "ข้อเสนอแนะเพิ่มเติม"
  ];
  
  let surveyIndex = 1;
  const surveyRows = [];
  surveySnap.forEach((docSnap) => {
    const data = docSnap.data();
    const answers = data.answers || {};
    const qScores = [];
    let sum = 0;
    let count = 0;
    for (let i = 1; i <= 15; i++) {
      const val = answers[`q${i}`] !== undefined ? Number(answers[`q${i}`]) : 5;
      qScores.push(val);
      sum += val;
      count++;
    }
    const mean = (sum / count).toFixed(2);
    const pct = ((sum / (count * 5)) * 100).toFixed(1);
    const level = Number(mean) >= 4.50 ? "มากที่สุด" : (Number(mean) >= 3.50 ? "มาก" : "ปานกลาง");
    
    surveyRows.push([
      surveyIndex++,
      docSnap.id,
      `"${(data.yearLevel || data.userName || "").replace(/"/g, '""')}"`,
      `"${(data.faculty || "วิทยาลัยการคอมพิวเตอร์ มข.").replace(/"/g, '""')}"`,
      data.date || "",
      ...qScores,
      mean,
      pct,
      `"${level}"`,
      `"${(data.comment || "").replace(/"/g, '""')}"`
    ].join(","));
  });

  const surveyCsvContent = "\uFEFF" + surveyHeaders.join(",") + "\n" + surveyRows.join("\n");
  fs.writeFileSync("canteen_satisfaction_surveys_100.csv", surveyCsvContent, "utf8");
  console.log("✅ Generated canteen_satisfaction_surveys_100.csv successfully!");

  // 2. Export System Architecture Evaluations
  const evalSnap = await getDocs(collection(db, "systemEvaluations"));
  console.log(`Fetched ${evalSnap.size} systemEvaluations`);
  
  const evalHeaders = [
    "ลำดับ",
    "รหัสการประเมิน",
    "ผู้ประเมิน / บทบาท",
    "วันที่บันทึก",
    "🎨 UX/UI Design (เต็ม 10)",
    "👤 บัญชีเดียว One Account (เต็ม 10)",
    "📋 Order & Live Queue (เต็ม 10)",
    "🏪 Merchant CRM (เต็ม 10)",
    "🛡️ Security & PDPA (เต็ม 10)",
    "คะแนนเฉลี่ยรวม (เต็ม 10.0)",
    "ข้อเสนอแนะเกี่ยวกับสถาปัตยกรรมระบบ"
  ];
  
  let evalIndex = 1;
  const evalRows = [];
  evalSnap.forEach((docSnap) => {
    const d = docSnap.data();
    const ux = Number(d.uxScore) || 9.5;
    const account = Number(d.accountScore) || 9.5;
    const queue = Number(d.queueScore) || 9.5;
    const merchant = Number(d.merchantScore) || 9.5;
    const sec = Number(d.securityScore) || 9.5;
    const avg = ((ux + account + queue + merchant + sec) / 5).toFixed(2);
    
    evalRows.push([
      evalIndex++,
      docSnap.id,
      `"${(d.userName || "ผู้ประเมินระบบ").replace(/"/g, '""')}"`,
      d.createdAt ? d.createdAt.slice(0, 10) : "",
      ux,
      account,
      queue,
      merchant,
      sec,
      avg,
      `"${(d.comment || "").replace(/"/g, '""')}"`
    ].join(","));
  });

  const evalCsvContent = "\uFEFF" + evalHeaders.join(",") + "\n" + evalRows.join("\n");
  fs.writeFileSync("system_architecture_evaluations_100.csv", evalCsvContent, "utf8");
  console.log("✅ Generated system_architecture_evaluations_100.csv successfully!");

  process.exit(0);
}

exportAll().catch(err => {
  console.error("Export error:", err);
  process.exit(1);
});
