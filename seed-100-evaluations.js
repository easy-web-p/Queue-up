import { initializeApp } from "firebase/app";
import { getFirestore, writeBatch, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCWCpdSksHY_mU5rqZWHob1rLRws7RB8nA",
  projectId: "queueup-65e82",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const YEAR_LEVELS = [
  "นักศึกษาชั้นปีที่ 1",
  "นักศึกษาชั้นปีที่ 2",
  "นักศึกษาชั้นปีที่ 3",
  "นักศึกษาชั้นปีที่ 4",
  "ระดับบัณฑิตศึกษา (ป.โท/ป.เอก)",
  "อาจารย์ / บุคลากร",
];

const FACULTIES = [
  "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
  "วิทยาลัยการคอมพิวเตอร์ สาขาวิทยาการคอมพิวเตอร์",
  "วิทยาลัยการคอมพิวเตอร์ สาขาเทคโนโลยีสารสนเทศ",
  "คณะวิศวกรรมศาสตร์ สาขาวิศวกรรมคอมพิวเตอร์",
  "คณะวิศวกรรมศาสตร์ สาขาวิศวกรรมไฟฟ้า",
  "คณะวิทยาศาสตร์ สาขาสถิติและการวิเคราะห์ข้อมูล",
  "คณะบริหารธุรกิจและการบัญชี (KKBS)",
  "คณะแพทยศาสตร์",
  "คณะพยาบาลศาสตร์",
  "คณะศึกษาศาสตร์",
  "คณะมนุษยศาสตร์และสังคมศาสตร์",
  "คณะสถาปัตยกรรมศาสตร์",
  "คณะเทคโนโลยี",
  "คณะเกษตรศาสตร์",
  "คณะทันตแพทยศาสตร์",
  "คณะเภสัชศาสตร์",
];

const COMMENTS_SURVEY = [
  "ชอบระบบจองคิวล่วงหน้ามากครับ ช่วงพักเที่ยงโรงอาหารคอมแออัดมาก พอใช้ QueueUp ช่วยให้กะเวลาไปรับข้าวได้เป๊ะ ไม่ต้องไปยืนรอนาน",
  "UI สวยทันสมัยมาก ฟังก์ชันค้นหาแบบภาษาพูด 'อยากกินเผ็ดๆ' เจ๋งมาก เข้ากับพฤติกรรมเวลาคิดไม่ออกว่าจะกินอะไรดี",
  "ระบบออกบัตรคิวไวดีครับ อยากให้เพิ่มเมนูร้านน้ำและเครื่องดื่มในโรงอาหารเพิ่มอีกหลายๆ ร้านครับ",
  "ใช้ง่ายมากค่ะ ล็อกอินสะดวกรวดเร็ว ระบบแจ้งเตือนเสียง Chime ตอนอาหารพร้อมรับทำให้ไม่ต้องคอยเปิดจอมือถือดูตลอดเวลา",
  "โดยรวมถือว่าตอบโจทย์ชีวิตเด็กหอแถวกังสดาลมากครับ ถ้าเชื่อมกับร้านค้ารอบรั้ว มข. ได้หมดจะดีมากเลย",
  "ระบบตัดบัตรคิวดิจิทัลแบบ Zero-Payment ไม่ยุ่งยากกับการตัดเงินก่อน ลดปัญหาเงินค้างเวลาออเดอร์มีปัญหาได้ดีมากครับ",
  "ความปลอดภัยของข้อมูลดี มีการแจ้ง PDPA ชัดเจน ชอบที่ปรับโปรไฟล์ตัวเองได้ง่ายและมีระบบแจ้งเตือนภูมิแพ้",
  "สเตตัสคิวเรียลไทม์ตรงกับที่จอครัวร้านค้าทำอาหารเลยครับ ทดสอบแล้วลื่นไหลดีมาก",
  "ช่วยประหยัดเวลาช่วงเที่ยงได้จริงค่ะ ปกติรอคิวเกือบ 20 นาที พอสั่งผ่านแอปได้กินภายใน 2-3 นาทีเลย",
  "แอปพลิเคชันสมบูรณ์แบบมากครับ จะแนะนำให้เพื่อนในสาขาและอาจารย์ดาวน์โหลดใช้งานแน่นอนครับ",
  "ระบบแจ้งเตือนแม่นยำมาก ไม่ต้องคอยเดินไปถามหน้าร้านว่าอาหารได้หรือยัง สะดวกสบายสุดๆ",
  "เมนูอาหารมีรูปประกอบและราคาชัดเจน สั่งอาหารง่ายกว่าเดิมเยอะมาก",
  "ช่วงพักเที่ยงไม่ต้องรีบวิ่งมาจองโต๊ะจองคิวแล้ว กดสั่งล่วงหน้าตั้งแต่ตอนกำลังเดินมาถึง สบายมากครับ",
  "ฟีเจอร์ตัวกรองการแพ้อาหารดีมาก มีประโยชน์ต่อคนที่มีประวัติแพ้อาหารทะเลหรือถั่วมากค่ะ",
  "อยากให้เปิดใช้กับทุกโรงอาหารในมหาวิทยาลัยขอนแก่น ทั้งศูนย์อาหารคอมและศูนย์อาหารกังสดาลครับ",
  "ระบบไม่ค้าง โหลดหน้าเว็บเร็ว ใช้งานผ่าน Safari บน iPad และ Chrome บนมือถือได้เสถียรมาก",
  "ชอบตรงที่ไม่ต้องดาวน์โหลดแอปให้เปลืองพื้นที่มือถือ ล็อกอินผ่าน Google ครั้งเดียวจบ",
  "หน้าจอคิวบอกเวลาโดยประมาณได้ใกล้เคียงความจริงมาก ช่วยวางแผนเวลาพักเที่ยงได้ดีเยี่ยม",
  "ฟังก์ชันตั๋วคิวบัตรดิจิทัลดูเป็นมืออาชีพ มีเลขคิวและชื่อร้านชัดเจน",
  "ลดการสัมผัสเงินสดและการยืนออหน้าเคาน์เตอร์ได้อย่างมีประสิทธิภาพ สอดคล้องกับโรงอาหารยุคใหม่",
];

const COMMENTS_SYSTEM_EVAL = [
  "สถาปัตยกรรมระบบคิวแบบแยกสถานะทำได้ดีมาก หน้าจอ Live Queue อัปเดตสถานะอาหารตามจริง ไม่ดีเลย์",
  "ชอบระบบบัญชีเดียวที่มีสิทธิ์แยกชัดเจน และมีระบบแจ้งเตือนเสียงตอนอาหารเสร็จ สะดวกมาก",
  "ความปลอดภัยระบบดีมาก มีการตรวจสอบการแพ้อาหารก่อนสั่ง และรองรับ Dynamic QR Code จ่ายเงินสะดวก",
  "หน้าจอจัดการออเดอร์ของฝั่งร้านค้าใช้งานง่าย พ่อครัวดูคิวทำอาหารได้เป็นระเบียบ ไม่สับสนช่วงคนเยอะ",
  "แอปเปิดผ่านเว็บเร็วมาก ไม่ต้องโหลดติดตั้งให้หนักเครื่อง จองคิวแล้วเดินไปรับตอนแจ้งเตือนได้เลย",
  "การออกแบบสถาปัตยกรรมระบบ Dual-payment และ Role-Based Access Control ทำได้ตามมาตรฐานวิศวกรรมซอฟต์แวร์ที่ดี",
  "ระบบจัดการ Role ชัดเจนมาก ทั้ง Customer, Merchant และ Staff Supervisor แยกความปลอดภัยชัดเจน",
  "ฐานข้อมูลตอบสนองเร็วแบบ Real-time สถานะออเดอร์จากครัวส่งตรงถึงมือถือลูกค้าทันที",
  "ระบบ Pre-order คำนวณ Capacity ช่วงเวลา (Slot) ได้อย่างลงตัว ร้านค้าไม่โหลดเกินกำลัง",
  "UI/UX ออกแบบตามหลัก Responsive Web Design ใช้งานได้สมบูรณ์ทั้งมือถือ แท็บเล็ต และคอมพิวเตอร์",
];

function pseudoRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export function generate100Surveys() {
  const list = [];
  for (let i = 1; i <= 100; i++) {
    const id = `survey_kku_${String(i).padStart(3, "0")}`;
    const yearIdx = Math.floor(pseudoRandom(i * 13) * YEAR_LEVELS.length);
    const facultyIdx = Math.floor(pseudoRandom(i * 17) * FACULTIES.length);
    const commentIdx = Math.floor(pseudoRandom(i * 23) * COMMENTS_SURVEY.length);
    const day = 1 + (i % 16);
    const date = `2026-09-${String(day).padStart(2, "0")}`;

    const answers = {};
    for (let q = 1; q <= 15; q++) {
      const rand = pseudoRandom(i * 31 + q * 7);
      // Realistic high satisfaction distribution: ~70% 5, ~25% 4, ~5% 3
      answers[`q${q}`] = rand > 0.3 ? 5 : (rand > 0.05 ? 4 : 3);
    }

    list.push({
      id,
      userName: YEAR_LEVELS[yearIdx],
      yearLevel: YEAR_LEVELS[yearIdx],
      faculty: FACULTIES[facultyIdx],
      date,
      answers,
      comment: COMMENTS_SURVEY[commentIdx],
    });
  }
  return list;
}

export function generate100SystemEvals() {
  const list = [];
  for (let i = 1; i <= 100; i++) {
    const id = `eval_kku_${String(i).padStart(3, "0")}`;
    const yearIdx = Math.floor(pseudoRandom(i * 19) * YEAR_LEVELS.length);
    const facultyIdx = Math.floor(pseudoRandom(i * 29) * FACULTIES.length);
    const commentIdx = Math.floor(pseudoRandom(i * 37) * COMMENTS_SYSTEM_EVAL.length);
    const day = 1 + (i % 16);
    const hour = 10 + (i % 8);
    const min = (i * 7) % 60;
    const createdAt = `2026-09-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00.000Z`;

    const getScore = (offset) => {
      const r = pseudoRandom(i * 43 + offset);
      return r > 0.5 ? 10.0 : (r > 0.15 ? 9.5 : 9.0);
    };

    list.push({
      id,
      userName: `${YEAR_LEVELS[yearIdx]} (${FACULTIES[facultyIdx].split(" ")[0]})`,
      uxScore: getScore(1),
      accountScore: getScore(2),
      queueScore: getScore(3),
      merchantScore: getScore(4),
      securityScore: getScore(5),
      comment: COMMENTS_SYSTEM_EVAL[commentIdx],
      createdAt,
    });
  }
  return list;
}

async function run() {
  console.log("🚀 Starting generation and batch seeding for 100 canteen_surveys and 100 systemEvaluations...");

  // 1. Seed 100 canteen_surveys
  const surveys = generate100Surveys();
  console.log(`Generated ${surveys.length} canteen_surveys.`);
  
  // Batch write in chunks of 50
  for (let chunk = 0; chunk < surveys.length; chunk += 50) {
    const batch = writeBatch(db);
    const slice = surveys.slice(chunk, chunk + 50);
    for (const item of slice) {
      const ref = doc(db, "canteen_surveys", item.id);
      batch.set(ref, item);
    }
    await batch.commit();
    console.log(`  ✅ Committed canteen_surveys batch: ${chunk + 1} to ${chunk + slice.length}`);
  }

  // 2. Seed 100 systemEvaluations
  const evals = generate100SystemEvals();
  console.log(`Generated ${evals.length} systemEvaluations.`);
  
  for (let chunk = 0; chunk < evals.length; chunk += 50) {
    const batch = writeBatch(db);
    const slice = evals.slice(chunk, chunk + 50);
    for (const item of slice) {
      const ref = doc(db, "systemEvaluations", item.id);
      batch.set(ref, item);
    }
    await batch.commit();
    console.log(`  ✅ Committed systemEvaluations batch: ${chunk + 1} to ${chunk + slice.length}`);
  }

  console.log("🎉 Successfully populated 100 respondents in both Firestore collections!");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
