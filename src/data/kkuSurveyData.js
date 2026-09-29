import { CANTEEN_SURVEYS_DATA } from './canteenEvaluationData';

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
 * Sample Population: 110 Real Students & Staff from 16 Faculties (Khon Kaen University)
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
 * 110 Real Pilot Survey Responses from 16 Faculties (KKU)
 * Sourced directly from canteen_satisfaction_surveys_100.csv
 */
export const PILOT_STUDENT_SURVEYS = CANTEEN_SURVEYS_DATA;

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
 * Seeding surveys from the browser was removed.
 *
 * canteen_surveys is written by the server only — the rules refused every write
 * this made, and nothing called it. Seed the collection with the Admin SDK if
 * the page should show something other than the dataset in the bundle.
 */

/**
 * Reads the survey responses the server holds, falling back to what this
 * browser has kept. The client used to read the collection directly, which the
 * rules refuse, so the page only ever charted the dataset in the bundle.
 */
export async function fetchSurveysFromFirestore() {
  try {
    const res = await fetch('/api/surveys?limit=200');
    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.surveys) && data.surveys.length > 0) {
      const local = getStoredSatisfactionSurveys();
      const existingIds = new Set(data.surveys.map((s) => s.id));
      return [...data.surveys, ...local.filter((l) => !existingIds.has(l.id))];
    }
  } catch (err) {
    console.warn('[Surveys] fetch fallback to local:', err);
  }
  return getStoredSatisfactionSurveys();
}

/**
 * Submits one response.
 *
 * Writing to canteen_surveys from the browser was refused by rules every time
 * and the refusal was swallowed, so every student's answers were thanked for and
 * then dropped — the data this project reports on. A failure is raised now, and
 * the local copy is kept only once the server has the response.
 */
export async function submitSurveyToFirestore(_db, surveyData) {
  const res = await fetch('/api/surveys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(surveyData)
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || data?.error || 'ไม่สามารถบันทึกแบบประเมินได้');
  }

  saveSatisfactionSurvey(data.survey);
  return data.survey;
}

