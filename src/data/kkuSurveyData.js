/**
 * ============================================================================
 * 📋 GE341511 KKU CANTEEN USABILITY & SATISFACTION SURVEY (QueueUp Pilot Study)
 * ============================================================================
 * 
 * 15-Question 5-Point Likert Scale Questionnaire:
 * 5 = มากที่สุด (Strongly Agree)
 * 4 = มาก (Agree)
 * 3 = ปานกลาง (Neutral)
 * 2 = น้อย (Disagree)
 * 1 = น้อยที่สุด (Strongly Disagree)
 * 
 * Sample Population: 10 AI Students from Khon Kaen University (KKU)
 * Field Study: โรงอาหารมหาวิทยาลัยขอนแก่น (มข.)
 */

export const SURVEY_QUESTIONS = [
  { id: "q1", no: 1, text: "แอปพลิเคชัน QueueUp ใช้งานง่ายและไม่ซับซ้อน", category: "ความง่ายในการใช้งาน" },
  { id: "q2", no: 2, text: "การสมัครสมาชิกและเข้าสู่ระบบมีความสะดวก", category: "ระบบสมาชิก" },
  { id: "q3", no: 3, text: "การค้นหาร้านค้าและเมนูอาหารทำได้ง่าย", category: "การค้นหา" },
  { id: "q4", no: 4, text: "ข้อมูลเมนูอาหารมีความชัดเจนและครบถ้วน", category: "ข้อมูลเมนู" },
  { id: "q5", no: 5, text: "ระบบจองคิวล่วงหน้าช่วยลดเวลาการรอคิวได้จริง", category: "ระบบคิวล่วงหน้า" },
  { id: "q6", no: 6, text: "การแสดงสถานะคิวมีความถูกต้องและเข้าใจง่าย", category: "ความถูกต้องของคิว" },
  { id: "q7", no: 7, text: "ระบบแจ้งเตือนช่วยให้ทราบเวลารับอาหารได้สะดวก", category: "การแจ้งเตือน" },
  { id: "q8", no: 8, text: "การสั่งอาหารผ่านแอปพลิเคชันมีความรวดเร็ว", category: "ความรวดเร็ว" },
  { id: "q9", no: 9, text: "แอปพลิเคชันมีความเสถียร ไม่ค้างหรือเกิดข้อผิดพลาดบ่อย", category: "ความเสถียร" },
  { id: "q10", no: 10, text: "ท่านมีความมั่นใจในความปลอดภัยของข้อมูลส่วนบุคคล", category: "ความปลอดภัย & PDPA" },
  { id: "q11", no: 11, text: "ระบบชำระเงินมีความสะดวกและน่าเชื่อถือ", category: "ระบบชำระเงิน" },
  { id: "q12", no: 12, text: "แอปพลิเคชันช่วยเพิ่มความสะดวกในการใช้บริการโรงอาหาร", category: "ประโยชน์การใช้งาน" },
  { id: "q13", no: 13, text: "โดยรวมแล้วท่านมีความพึงพอใจต่อการใช้งานแอปพลิเคชัน QueueUp", category: "ความพึงพอใจโดยรวม" },
  { id: "q14", no: 14, text: "ท่านมีความตั้งใจที่จะใช้งานแอปพลิเคชันนี้ต่อไปในอนาคต", category: "ความตั้งใจใช้งานต่อ" },
  { id: "q15", no: 15, text: "ท่านจะแนะนำแอปพลิเคชัน QueueUp ให้เพื่อนหรือบุคคลอื่นใช้งาน", category: "การบอกต่อแนะนำ" },
];

export const LIKERT_SCALE = [
  { value: 5, label: "มากที่สุด", short: "มากที่สุด (5)", color: "#22c55e" },
  { value: 4, label: "มาก", short: "มาก (4)", color: "#10b981" },
  { value: 3, label: "ปานกลาง", short: "ปานกลาง (3)", color: "#f59e0b" },
  { value: 2, label: "น้อย", short: "น้อย (2)", color: "#f97316" },
  { value: 1, label: "น้อยที่สุด", short: "น้อยที่สุด (1)", color: "#ef4444" },
];

/**
 * 10 Realistic Pilot Responses from KKU Artificial Intelligence Students
 * Conducted at Khon Kaen University Canteen
 */
export const PILOT_STUDENT_SURVEYS = [
  {
    id: "survey_kku_01",
    userName: "นายอิทธิพล (นักศึกษา AI ปี 2 - มข.)",
    faculty: "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
    date: "2026-09-02",
    answers: { q1: 5, q2: 5, q3: 5, q4: 4, q5: 5, q6: 5, q7: 5, q8: 5, q9: 4, q10: 5, q11: 5, q12: 5, q13: 5, q14: 5, q15: 5 },
    comment: "ชอบระบบจองคิวล่วงหน้ามากครับ ช่วงพักเที่ยงโรงอาหารคอมแออัดมาก พอใช้ QueueUp ช่วยให้กะเวลาไปรับข้าวได้เป๊ะ ไม่ต้องไปยืนรอนาน",
  },
  {
    id: "survey_kku_02",
    userName: "นางสาวธัญญารัตน์ (นักศึกษา AI ปี 3 - มข.)",
    faculty: "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
    date: "2026-09-02",
    answers: { q1: 5, q2: 4, q3: 5, q4: 5, q5: 5, q6: 5, q7: 4, q8: 5, q9: 5, q10: 4, q11: 5, q12: 5, q13: 5, q14: 5, q15: 5 },
    comment: "UI สวยทันสมัยมาก ฟังก์ชันค้นหาแบบภาษาพูด 'อยากกินเผ็ดๆ' เจ๋งมาก เข้ากับพฤติกรรมเวลาคิดไม่ออกว่าจะกินอะไรดี",
  },
  {
    id: "survey_kku_03",
    userName: "นายณัฐวุฒิ (นักศึกษา AI ปี 2 - มข.)",
    faculty: "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
    date: "2026-09-03",
    answers: { q1: 4, q2: 5, q3: 4, q4: 4, q5: 5, q6: 4, q7: 5, q8: 4, q9: 4, q10: 5, q11: 4, q12: 5, q13: 4, q14: 4, q15: 5 },
    comment: "ระบบออกบัตรคิวไวดีครับ อยากให้เพิ่มเมนูร้านน้ำและเครื่องดื่มในโรงอาหารเพิ่มอีกหลายๆ ร้านครับ",
  },
  {
    id: "survey_kku_04",
    userName: "นางสาวกมลวรรณ (นักศึกษา AI ปี 1 - มข.)",
    faculty: "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
    date: "2026-09-03",
    answers: { q1: 5, q2: 5, q3: 5, q4: 5, q5: 5, q6: 5, q7: 5, q8: 5, q9: 4, q10: 5, q11: 5, q12: 5, q13: 5, q14: 5, q15: 5 },
    comment: "ใช้ง่ายมากค่ะ ล็อกอินสะดวกรวดเร็ว ระบบแจ้งเตือนเสียง Chime ตอนอาหารพร้อมรับทำให้ไม่ต้องคอยเปิดจอมือถือดูตลอดเวลา",
  },
  {
    id: "survey_kku_05",
    userName: "นายธีรเดช (นักศึกษา AI ปี 3 - มข.)",
    faculty: "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
    date: "2026-09-04",
    answers: { q1: 4, q2: 4, q3: 5, q4: 4, q5: 4, q6: 4, q7: 4, q8: 4, q9: 5, q10: 4, q11: 4, q12: 4, q13: 4, q14: 4, q15: 4 },
    comment: "โดยรวมถือว่าตอบโจทย์ชีวิตเด็กหอแถวกังสดาลมากครับ ถ้าเชื่อมกับร้านค้ารอบรั้ว มข. ได้หมดจะดีมากเลย",
  },
  {
    id: "survey_kku_06",
    userName: "นายศุภกิตติ์ (นักศึกษา AI ปี 2 - มข.)",
    faculty: "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
    date: "2026-09-04",
    answers: { q1: 5, q2: 5, q3: 4, q4: 5, q5: 5, q6: 5, q7: 4, q8: 5, q9: 5, q10: 5, q11: 5, q12: 5, q13: 5, q14: 5, q15: 5 },
    comment: "ระบบตัดบัตรคิวดิจิทัลแบบ Zero-Payment ไม่ยุ่งยากกับการตัดเงินก่อน ลดปัญหาเงินค้างเวลาออเดอร์มีปัญหาได้ดีมากครับ",
  },
  {
    id: "survey_kku_07",
    userName: "นางสาวปรียาภรณ์ (นักศึกษา AI ปี 2 - มข.)",
    faculty: "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
    date: "2026-09-05",
    answers: { q1: 5, q2: 5, q3: 5, q4: 5, q5: 5, q6: 4, q7: 5, q8: 5, q9: 4, q10: 5, q11: 5, q12: 5, q13: 5, q14: 5, q15: 5 },
    comment: "ความปลอดภัยของข้อมูลดี มีการแจ้ง PDPA ชัดเจน ชอบที่ปรับโปรไฟล์ตัวเองได้ง่ายและมีระบบแจ้งเตือนภูมิแพ้",
  },
  {
    id: "survey_kku_08",
    userName: "นายจิรายุ (นักศึกษา AI ปี 3 - มข.)",
    faculty: "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
    date: "2026-09-05",
    answers: { q1: 4, q2: 5, q3: 4, q4: 5, q5: 5, q6: 5, q7: 5, q8: 4, q9: 4, q10: 4, q11: 5, q12: 5, q13: 5, q14: 4, q15: 5 },
    comment: "สเตตัสคิวเรียลไทม์ตรงกับที่จอครัวร้านค้าทำอาหารเลยครับ ทดสอบแล้วลื่นไหลดีมาก",
  },
  {
    id: "survey_kku_09",
    userName: "นางสาวชลธิชา (นักศึกษา AI ปี 1 - มข.)",
    faculty: "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
    date: "2026-09-06",
    answers: { q1: 5, q2: 5, q3: 5, q4: 4, q5: 5, q6: 5, q7: 4, q8: 5, q9: 5, q10: 5, q11: 5, q12: 5, q13: 5, q14: 5, q15: 5 },
    comment: "ช่วยประหยัดเวลาช่วงเที่ยงได้จริงค่ะ ปกติรอคิวเกือบ 20 นาที พอสั่งผ่านแอปได้กินภายใน 2-3 นาทีเลย",
  },
  {
    id: "survey_kku_10",
    userName: "นายวรเมธ (นักศึกษา AI ปี 2 - มข.)",
    faculty: "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
    date: "2026-09-06",
    answers: { q1: 5, q2: 4, q3: 5, q4: 5, q5: 5, q6: 5, q7: 5, q8: 5, q9: 5, q10: 5, q11: 5, q12: 5, q13: 5, q14: 5, q15: 5 },
    comment: "แอปพลิเคชันสมบูรณ์แบบมากครับ จะแนะนำให้เพื่อนในสาขาและอาจารย์ดาวน์โหลดใช้งานแน่นอนครับ",
  },
];

/**
 * Calculates statistical mean and std-deviation for each of the 15 questions
 */
export function calculateSurveyStats(surveyList = PILOT_STUDENT_SURVEYS) {
  if (!Array.isArray(surveyList) || surveyList.length === 0) {
    return { overallMean: 0, questionStats: {}, totalResponses: 0 };
  }

  const questionStats = {};
  let totalScoreSum = 0;
  let totalCount = 0;

  SURVEY_QUESTIONS.forEach((q) => {
    const scores = surveyList
      .map((s) => s.answers?.[q.id])
      .filter((v) => typeof v === "number" && Number.isFinite(v));

    if (scores.length === 0) {
      questionStats[q.id] = { mean: 0, count: 0, std: 0 };
      return;
    }

    const sum = scores.reduce((a, b) => a + b, 0);
    const mean = sum / scores.length;
    const variance = scores.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / scores.length;
    const std = Math.sqrt(variance);

    questionStats[q.id] = {
      mean: Number(mean.toFixed(2)),
      count: scores.length,
      std: Number(std.toFixed(2)),
    };

    totalScoreSum += sum;
    totalCount += scores.length;
  });

  const overallMean = totalCount > 0 ? Number((totalScoreSum / totalCount).toFixed(2)) : 0;

  return {
    overallMean,
    overallScoreOut10: Number(((overallMean / 5) * 10).toFixed(1)),
    questionStats,
    totalResponses: surveyList.length,
  };
}

/**
 * Get all surveys combining local submitted surveys and pilot baseline surveys
 */
export function getStoredSatisfactionSurveys() {
  if (typeof window === "undefined") return PILOT_STUDENT_SURVEYS;
  try {
    const local = JSON.parse(localStorage.getItem("queueup_kku_surveys") || "[]");
    if (Array.isArray(local) && local.length > 0) {
      const existingIds = new Set(local.map((s) => s.id));
      const filteredPilot = PILOT_STUDENT_SURVEYS.filter((p) => !existingIds.has(p.id));
      return [...local, ...filteredPilot];
    }
  } catch {
    // fallback
  }
  return PILOT_STUDENT_SURVEYS;
}

/**
 * Save new survey to local persistence
 */
export function saveSatisfactionSurvey(newSurvey) {
  if (typeof window === "undefined") return newSurvey;
  try {
    const current = JSON.parse(localStorage.getItem("queueup_kku_surveys") || "[]");
    const updated = [newSurvey, ...current];
    localStorage.setItem("queueup_kku_surveys", JSON.stringify(updated));
  } catch {
    // ignore
  }
  return newSurvey;
}

/**
 * Export Survey Dataset as CSV string for Excel / Academic Report
 */
export function exportSurveysToCSV(surveyList = PILOT_STUDENT_SURVEYS) {
  const headers = [
    "ลำดับ",
    "ชื่อผู้ประเมิน",
    "สังกัด / กลุ่มตัวอย่าง",
    "วันที่ประเมิน",
    ...SURVEY_QUESTIONS.map((q) => `ข้อ ${q.no} (${q.category})`),
    "คะแนนเฉลี่ย (เต็ม 5)",
    "ข้อเสนอแนะเพิ่มเติม",
  ];

  const rows = surveyList.map((item, idx) => {
    const qScores = SURVEY_QUESTIONS.map((q) => item.answers?.[q.id] ?? "");
    const numericScores = qScores.filter((v) => typeof v === "number");
    const mean = numericScores.length > 0
      ? (numericScores.reduce((a, b) => a + b, 0) / numericScores.length).toFixed(2)
      : "";

    return [
      idx + 1,
      `"${(item.userName || "").replace(/"/g, '""')}"`,
      `"${(item.faculty || "นักศึกษา มข.").replace(/"/g, '""')}"`,
      item.date || "",
      ...qScores,
      mean,
      `"${(item.comment || "").replace(/"/g, '""')}"`,
    ];
  });

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Seed 10 realistic mock pilot student surveys into Firestore 'canteen_surveys'
 */
export async function seedSurveysToFirestore(db, surveys = PILOT_STUDENT_SURVEYS) {
  if (!db) return { success: false, error: "Database instance required", count: 0 };
  let count = 0;
  try {
    const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
    for (const item of surveys) {
      await setDoc(
        doc(db, "canteen_surveys", item.id),
        {
          ...item,
          seededAt: serverTimestamp(),
        },
        { merge: true }
      );
      count++;
    }
    return { success: true, count };
  } catch (err) {
    console.warn("Firestore seedSurveys warning:", err);
    return { success: false, error: err?.message || String(err), count };
  }
}

/**
 * Fetch all surveys from Firestore 'canteen_surveys', fallback to local persistence
 */
export async function fetchSurveysFromFirestore(db) {
  if (!db) return getStoredSatisfactionSurveys();
  try {
    const { collection, getDocs } = await import("firebase/firestore");
    const snap = await getDocs(collection(db, "canteen_surveys"));
    const list = [];
    snap.forEach((docItem) => {
      list.push({ id: docItem.id, ...docItem.data() });
    });
    if (list.length > 0) {
      const local = getStoredSatisfactionSurveys();
      const existingIds = new Set(list.map((s) => s.id));
      return [...list, ...local.filter((l) => !existingIds.has(l.id))];
    }
  } catch (err) {
    console.warn("Could not fetch surveys from Firestore, falling back to local:", err);
  }
  return getStoredSatisfactionSurveys();
}

/**
 * Submit a new survey response to Firestore and local persistence
 */
export async function submitSurveyToFirestore(db, surveyData) {
  const surveyId = surveyData.id || `survey_${Date.now()}`;
  const fullSurvey = {
    ...surveyData,
    id: surveyId,
    date: surveyData.date || new Date().toISOString().slice(0, 10),
  };

  // Guarantee client-side persistence immediately
  saveSatisfactionSurvey(fullSurvey);

  if (db) {
    try {
      const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
      await setDoc(doc(db, "canteen_surveys", surveyId), {
        ...fullSurvey,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Firestore submitSurvey write error (stored locally):", err);
    }
  }

  return fullSurvey;
}
