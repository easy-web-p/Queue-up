import os
import base64
import subprocess
import shutil

# Directories
secure_dir = os.path.abspath(r"d:\พัฒนาเว็บแอปพลิเคชัน\secure-reports\GE341511_QueueUp_Evaluation")
docs_backup_dir = os.path.expanduser(r"~\Documents\QueueUp_Confidential_Reports")
os.makedirs(secure_dir, exist_ok=True)
os.makedirs(docs_backup_dir, exist_ok=True)

# Helper to load image as base64
def get_image_base64(filename):
    filepath = os.path.join(secure_dir, filename)
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")
    with open(filepath, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"

print("Loading chart images...")
b64_chart1 = get_image_base64("1_กราฟแท่ง_คะแนนความพึงพอใจรายด้าน_QueueUp.png")
b64_chart2 = get_image_base64("2_กราฟวงกลม_สัดส่วนระดับความพึงพอใจและกลุ่มตัวอย่าง_QueueUp.png")
b64_chart3 = get_image_base64("3_กราฟเส้น_แนวโน้มการประเมินตามช่วงเวลา_QueueUp.png")

html_content = f"""<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>รายงานผลการประเมินและแผนพัฒนาแอปพลิเคชัน QueueUp (GE341511)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page {{
    size: A4 portrait;
    margin: 10mm 12mm 10mm 12mm;
  }}

  * {{
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }}

  body {{
    margin: 0;
    padding: 0;
    font-family: 'Sarabun', 'Prompt', 'Leelawadee UI', Tahoma, sans-serif;
    color: #1e293b;
    background-color: #ffffff;
    font-size: 13px;
    line-height: 1.55;
  }}

  .page {{
    page-break-after: always;
    height: 100%;
    min-height: 275mm;
    position: relative;
    padding-bottom: 8mm;
  }}

  .page:last-child {{
    page-break-after: avoid;
  }}

  /* Typography */
  h1, h2, h3, h4, .font-heading {{
    font-family: 'Prompt', 'Sarabun', sans-serif;
  }}

  /* Page Header & Footer */
  .doc-header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #ea580c;
    padding-bottom: 6px;
    margin-bottom: 12px;
  }}

  .doc-header .brand {{
    font-size: 14px;
    font-weight: 700;
    color: #ea580c;
    display: flex;
    align-items: center;
    gap: 6px;
  }}

  .doc-header .course-info {{
    font-size: 11px;
    color: #64748b;
    text-align: right;
  }}

  .doc-footer {{
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #94a3b8;
    border-top: 1px solid #e2e8f0;
    padding-top: 4px;
  }}

  /* ==========================================================================
     PAGE 1: EXECUTIVE DASHBOARD
     ========================================================================== */
  .dash-title-block {{
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: #ffffff;
    border-radius: 10px;
    padding: 12px 18px;
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  }}

  .dash-title-block h1 {{
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #ffedd5;
  }}

  .dash-title-block p {{
    margin: 3px 0 0 0;
    font-size: 11.5px;
    color: #cbd5e1;
  }}

  .badge-tag {{
    background-color: #ea580c;
    color: #ffffff;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }}

  /* KPI Grid */
  .kpi-grid {{
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 12px;
  }}

  .kpi-card {{
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px;
    text-align: center;
    border-top: 3px solid #ea580c;
  }}

  .kpi-card.blue {{ border-top-color: #0284c7; }}
  .kpi-card.green {{ border-top-color: #10b981; }}
  .kpi-card.purple {{ border-top-color: #8b5cf6; }}

  .kpi-card .label {{
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    margin-bottom: 2px;
  }}

  .kpi-card .value {{
    font-size: 22px;
    font-weight: 800;
    color: #0f172a;
    font-family: 'Inter', 'Prompt', sans-serif;
    line-height: 1.1;
  }}

  .kpi-card .sub {{
    font-size: 10px;
    color: #16a34a;
    font-weight: 600;
    margin-top: 2px;
  }}

  /* Charts Layout */
  .dash-charts-grid {{
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }}

  .chart-box {{
    background: #0f172a;
    border-radius: 8px;
    padding: 6px 10px 8px 10px;
    text-align: center;
    border: 1px solid #334155;
  }}

  .chart-box-title {{
    font-size: 11.5px;
    font-weight: 700;
    color: #f8fafc;
    margin-bottom: 4px;
    text-align: left;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }}

  .chart-box-title .pill {{
    background: #334155;
    color: #cbd5e1;
    font-size: 9.5px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
  }}

  .chart-box img {{
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    display: block;
    margin: 0 auto;
  }}

  .chart-row-double {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }}

  /* Summary highlight box on Page 1 */
  .dash-summary-callout {{
    background: #fff7ed;
    border-left: 4px solid #ea580c;
    padding: 8px 12px;
    border-radius: 0 6px 6px 0;
    margin-top: 10px;
    font-size: 11.5px;
    color: #9a3412;
    line-height: 1.45;
  }}

  /* ==========================================================================
     PAGES 2-4: REPORT DETAILS
     ========================================================================== */
  .section-title {{
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
    border-left: 4px solid #ea580c;
    padding-left: 8px;
    margin-top: 0;
    margin-bottom: 10px;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }}

  .section-title .en-sub {{
    font-size: 11px;
    font-weight: 400;
    color: #64748b;
  }}

  .content-card {{
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 12px;
  }}

  .content-card h3 {{
    margin: 0 0 6px 0;
    font-size: 13.5px;
    color: #ea580c;
    font-weight: 700;
  }}

  .grid-2col {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }}

  .stat-table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    margin-top: 6px;
  }}

  .stat-table th {{
    background-color: #0f172a;
    color: #ffffff;
    text-align: center;
    padding: 6px 8px;
    font-weight: 600;
    border: 1px solid #334155;
  }}

  .stat-table td {{
    padding: 5px 8px;
    border: 1px solid #e2e8f0;
    color: #334155;
  }}

  .stat-table tr:nth-child(even) {{
    background-color: #f1f5f9;
  }}

  .highlight-tag {{
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 9.5px;
    font-weight: 600;
  }}

  .tag-green {{ background: #dcfce7; color: #15803d; }}
  .tag-orange {{ background: #ffedd5; color: #c2410c; }}
  .tag-blue {{ background: #e0f2fe; color: #0369a1; }}

  /* Roadmap Timeline Styles */
  .roadmap-phase {{
    border-left: 3px solid #ea580c;
    padding-left: 12px;
    margin-bottom: 12px;
    position: relative;
  }}

  .roadmap-phase::before {{
    content: '';
    position: absolute;
    left: -7px;
    top: 2px;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: #ea580c;
  }}

  .phase-header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }}

  .phase-title {{
    font-size: 13.5px;
    font-weight: 700;
    color: #0f172a;
  }}

  .phase-time {{
    font-size: 10.5px;
    font-weight: 600;
    background: #e2e8f0;
    color: #475569;
    padding: 2px 8px;
    border-radius: 12px;
  }}

  .quote-box {{
    background: #ffffff;
    border-left: 3px solid #38bdf8;
    padding: 8px 12px;
    border-radius: 4px;
    font-style: italic;
    font-size: 11.5px;
    color: #334155;
    margin-bottom: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }}

  .quote-author {{
    font-style: normal;
    font-weight: 600;
    color: #0284c7;
    font-size: 10.5px;
    margin-top: 2px;
  }}
</style>
</head>
<body>

  <!-- =======================================================================
       PAGE 1: ONE-PAGE EXECUTIVE DASHBOARD (ตามโจทย์การส่งงาน)
       ======================================================================= -->
  <div class="page">
    <div class="doc-header">
      <div class="brand">
        <span style="font-size: 18px;">🍽️</span> QueueUp Executive Dashboard
      </div>
      <div class="course-info">
        <strong>วิชา GE341511</strong> การคิดเชิงคำนวณและเชิงสถิติสำหรับ ABCD<br>
        กลุ่มที่ 23 • มหาวิทยาลัยขอนแก่น (ภาคการศึกษา 1/2569)
      </div>
    </div>

    <!-- Title Banner -->
    <div class="dash-title-block">
      <div>
        <h1>Dashboard รายงานผลการประเมินการใช้งานแอปพลิเคชัน QueueUp</h1>
        <p>การสำรวจกลุ่มตัวอย่างนักศึกษา วิทยาลัยการคอมพิวเตอร์ มข. (Pilot Field Study ณ โรงอาหารคอม) • 10 คน</p>
      </div>
      <div>
        <span class="badge-tag">Executive Summary</span>
      </div>
    </div>

    <!-- 4 KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="label">คะแนนความพึงพอใจเฉลี่ยรวม</div>
        <div class="value" style="color: #ea580c;">4.73 <span style="font-size: 13px; font-weight: normal; color: #64748b;">/ 5.00</span></div>
        <div class="sub">ระดับ "มากที่สุด" (Very High)</div>
      </div>
      <div class="kpi-card green">
        <div class="label">ดัชนีความพึงพอใจรวม (Satisfaction)</div>
        <div class="value" style="color: #10b981;">94.6%</div>
        <div class="sub">ไม่มีคะแนนต่ำกว่า 4 ดาว</div>
      </div>
      <div class="kpi-card blue">
        <div class="label">สัดส่วนคำตอบระดับ 5 ดาว</div>
        <div class="value" style="color: #0284c7;">75.3%</div>
        <div class="sub">113 จาก 150 คำตอบทั้งหมด</div>
      </div>
      <div class="kpi-card purple">
        <div class="label">กลุ่มตัวอย่างภาคสนามจริง</div>
        <div class="value" style="color: #8b5cf6;">10 คน</div>
        <div class="sub">นศ. สาขา AI ชั้นปีที่ 1-3</div>
      </div>
    </div>

    <!-- Dashboard Charts Grid (3 รูปครบถ้วนตามโจทย์) -->
    <div class="dash-charts-grid">
      <!-- รูปที่ 1: กราฟแท่ง -->
      <div class="chart-box">
        <div class="chart-box-title">
          <span>1. กราฟแท่ง (Bar Chart) — คะแนนเฉลี่ยเปรียบเทียบตามข้อคำถาม 15 ด้าน</span>
          <span class="pill">คะแนนสูงสุด 4.90 / 5.00 (ข้อ 7, 9, 14)</span>
        </div>
        <img src="{b64_chart1}" style="max-height: 98mm;" alt="กราฟแท่งความพึงพอใจรายด้าน">
      </div>

      <!-- แถวคู่: รูปที่ 2 กราฟวงกลม & รูปที่ 3 กราฟเส้น -->
      <div class="chart-row-double">
        <!-- รูปที่ 2: กราฟวงกลม -->
        <div class="chart-box">
          <div class="chart-box-title">
            <span>2. กราฟวงกลม — สัดส่วนร้อยละระดับคะแนน & ชั้นปี</span>
            <span class="pill">5 ดาว (75.3%) vs 4 ดาว (24.7%)</span>
          </div>
          <img src="{b64_chart2}" style="max-height: 68mm;" alt="กราฟวงกลมสัดส่วนความพึงพอใจ">
        </div>

        <!-- รูปที่ 3: กราฟเส้น -->
        <div class="chart-box">
          <div class="chart-box-title">
            <span>3. กราฟเส้น — แนวโน้มคะแนนเฉลี่ยตามช่วงเวลา (2-6 ก.ย.)</span>
            <span class="pill">แนวโน้มเติบโต +0.34 จุด</span>
          </div>
          <img src="{b64_chart3}" style="max-height: 68mm;" alt="กราฟเส้นแนวโน้มการประเมิน">
        </div>
      </div>
    </div>

    <!-- Summary Callout -->
    <div class="dash-summary-callout">
      <strong>สรุปผลภาพรวมจาก Dashboard:</strong> ผลการประเมินสะท้อนว่าระบบ QueueUp สามารถแก้ปัญหาคอขวดเวลารอคอยในโรงอาหารได้อย่างมีนัยสำคัญ ฟังก์ชันคิวเรียลไทม์ (Q7 = 4.90), ความมั่นใจในการชำระเงินแบบ Zero-Payment (Q9 = 4.90) และการช่วยลดความแออัด (Q14 = 4.90) ได้รับคะแนนสูงสุด โดยแนวโน้มคะแนนเฉลี่ยรายวันปรับตัวสูงขึ้นอย่างต่อเนื่องตลอดช่วงทดลอง
    </div>

    <div class="doc-footer">
      <span>เอกสารส่งงานวิชา GE341511 โครงการพัฒนา QueueUp • กลุ่ม 23</span>
      <span>หน้า 1 จาก 4 (หน้า Dashboard)</span>
    </div>
  </div>


  <!-- =======================================================================
       PAGE 2: การอธิบายผลของข้อมูลที่ได้
       ======================================================================= -->
  <div class="page">
    <div class="doc-header">
      <div class="brand">QueueUp Analytical Report</div>
      <div class="course-info">ส่วนที่ 1: การอธิบายผลของข้อมูลที่ได้จากการประเมิน • GE341511</div>
    </div>

    <div class="section-title">
      <span>1. การอธิบายผลและวิเคราะห์ข้อมูลเชิงสถิติ (Evaluation Results Analysis)</span>
      <span class="en-sub">Quantitative Data Interpretation</span>
    </div>

    <p style="margin-top: 0; color: #475569; font-size: 12px;">
      จากการรวบรวมแบบประเมินความพึงพอใจการใช้งานแอปพลิเคชัน QueueUp มาตรวัด Likert Scale 5 ระดับ (1 = น้อยที่สุด ถึง 5 = มากที่สุด) จำนวน 15 ข้อคำถาม จากกลุ่มตัวอย่างนักศึกษาตัวจริงที่ร่วมทดสอบในโรงอาหารคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น จำนวน 10 คน ได้ผลการวิเคราะห์ข้อมูลดังนี้:
    </p>

    <div class="grid-2col">
      <!-- หมวด 1-2 -->
      <div class="content-card">
        <h3>1.1 ด้านการใช้งานทั่วไป & การค้นหา (Q1 - Q4)</h3>
        <p style="margin: 0 0 6px 0; font-size: 12px; color: #334155;">
          <strong>คะแนนเฉลี่ยหมวด: 4.65 / 5.00 (มากที่สุด)</strong><br>
          ผู้ใช้งานให้คะแนนความง่ายในการสมัครสมาชิกและล็อกอินสูงถึง <strong>4.70</strong> ขณะที่ความชัดเจนของข้อมูลเมนูอยู่ที่ <strong>4.70</strong> จุดเด่นสำคัญคือการมี UI แบบ Responsive ที่รองรับการใช้งานบนมือถือได้ลื่นไหล ไม่ซับซ้อน
        </p>
        <span class="highlight-tag tag-blue">UI Intuitive & Accessible</span>
      </div>

      <div class="content-card">
        <h3>1.2 ด้านระบบการสั่งอาหาร & การจัดการคิว (Q5 - Q8)</h3>
        <p style="margin: 0 0 6px 0; font-size: 12px; color: #334155;">
          <strong>คะแนนเฉลี่ยหมวด: 4.78 / 5.00 (มากที่สุด)</strong><br>
          เป็นหมวดที่ได้รับคะแนนเฉลี่ยสูงสุด โดยเฉพาะ <strong>ข้อ 7: ระบบแจ้งเตือนรับอาหารสะดวก แม่นยำ ได้รับ 4.90</strong> และระบบจองคิวล่วงหน้าช่วยลดเวลารอคอยได้จริง (ข้อ 5 ได้ 4.80) ชี้ชัดว่าแอปแก้ปัญหา Pain Point เรื่องการยืนรออาหารได้ตรงจุด
        </p>
        <span class="highlight-tag tag-orange">Core Value Proposition Solved</span>
      </div>
    </div>

    <div class="grid-2col" style="margin-top: 6px;">
      <!-- หมวด 3-4 -->
      <div class="content-card">
        <h3>1.3 ด้านความปลอดภัย & การชำระเงิน (Q9 - Q11)</h3>
        <p style="margin: 0 0 6px 0; font-size: 12px; color: #334155;">
          <strong>คะแนนเฉลี่ยหมวด: 4.77 / 5.00 (มากที่สุด)</strong><br>
          ผู้ใช้ให้ความไว้วางใจต่อ <strong>ระบบชำระเงินและสถาปัตยกรรม Zero-Payment สูงถึง 4.90</strong> และมีความมั่นใจในนโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA Consent) ที่ระดับ <strong>4.70</strong> ไม่พบปัญหาแอปค้างหรือ Error ในช่วงทดสอบ
        </p>
        <span class="highlight-tag tag-green">Zero-Payment Trust & PDPA</span>
      </div>

      <div class="content-card">
        <h3>1.4 ด้านประโยชน์ & ความพึงพอใจโดยรวม (Q12 - Q15)</h3>
        <p style="margin: 0 0 6px 0; font-size: 12px; color: #334155;">
          <strong>คะแนนเฉลี่ยหมวด: 4.73 / 5.00 (มากที่สุด)</strong><br>
          ความพึงพอใจโดยรวม (Q13) อยู่ที่ <strong>4.80</strong> และข้อที่ชี้วัดผลกระทบเชิงบวกชัดเจนที่สุดคือ <strong>ข้อ 14: แอปช่วยลดความแออัดบริเวณหน้าร้านอาหาร ได้รับคะแนนสูงถึง 4.90</strong> รวมถึงผู้ใช้ 100% ยืนยันว่าจะแนะนำให้ผู้อื่นใช้งานต่อ
        </p>
        <span class="highlight-tag tag-blue">High Net Promoter Score (NPS)</span>
      </div>
    </div>

    <div class="content-card" style="margin-top: 8px;">
      <h3>1.5 การวิเคราะห์แนวโน้มการเปลี่ยนแปลงตามช่วงเวลา (Time-Series Evaluation)</h3>
      <p style="margin: 0; font-size: 12px; color: #334155;">
        จากการติดตามข้อมูลการประเมิน 5 วันต่อเนื่อง (2 - 6 กันยายน 2026) พบว่า:
      </p>
      <ul style="margin: 4px 0 0 0; padding-left: 18px; font-size: 11.5px; color: #475569;">
        <li><strong>ช่วงเริ่มต้น (2 ก.ย.):</strong> คะแนนเฉลี่ยอยู่ที่ 4.53 เนื่องจากผู้ทดลองใช้งานยังไม่คุ้นเคยกับฟังก์ชันค้นหาอัจฉริยะ (NLP Search)</li>
        <li><strong>ช่วงกลาง (3 - 4 ก.ย.):</strong> คะแนนเฉลี่ยขยับขึ้นเป็น 4.77 และ 4.73 หลังผู้เรียนเริ่มคุ้นเคยกับการจองช่วงเวลาอาหารล่วงหน้า (Time-Slot)</li>
        <li><strong>ช่วงท้าย (5 - 6 ก.ย.):</strong> คะแนนเฉลี่ยพุ่งสูงขึ้นเป็น 4.80 และ 4.87 ตามลำดับ หลังทีมงานปรับแต่งเสียงเตือน Chime ให้ดังฟังชัด และเพิ่มคำแนะนำการรับคิว แสดงถึงการเรียนรู้ของผู้ใช้ (Learning Curve) และเสถียรภาพระบบที่สมบูรณ์</li>
      </ul>
    </div>

    <div class="doc-footer">
      <span>เอกสารส่งงานวิชา GE341511 โครงการพัฒนา QueueUp • กลุ่ม 23</span>
      <span>หน้า 2 จาก 4</span>
    </div>
  </div>


  <!-- =======================================================================
       PAGE 3: ข้อเสนอแนะที่ได้จากข้อมูล
       ======================================================================= -->
  <div class="page">
    <div class="doc-header">
      <div class="brand">QueueUp User Feedback & Insights</div>
      <div class="course-info">ส่วนที่ 2: ข้อเสนอแนะที่ได้จากข้อมูลกลุ่มตัวอย่าง • GE341511</div>
    </div>

    <div class="section-title">
      <span>2. ข้อเสนอแนะที่ได้จากข้อมูลกลุ่มตัวอย่าง (User Feedback & Qualitative Insights)</span>
      <span class="en-sub">Voice of the Customer (VoC)</span>
    </div>

    <p style="margin-top: 0; color: #475569; font-size: 12px;">
      นอกจากข้อมูลเชิงปริมาณ (Likert Scale) ทีมงานได้รวบรวมความคิดเห็นและข้อเสนอแนะเชิงลึก (Open-ended Feedback) จากนักศึกษาที่ทดลองใช้งานจริงในโรงอาหาร มข. โดยสามารถจำแนกออกเป็นประเด็นสำคัญได้ 3 มิติหลัก:
    </p>

    <!-- มิติที่ 1 -->
    <div class="content-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <h3 style="margin: 0;">มิติที่ 1: การขยายประเภทร้านค้าและเมนูเครื่องดื่ม (Store Category Expansion)</h3>
        <span class="highlight-tag tag-orange">คำขออันดับ 1 (30% ของผู้ประเมิน)</span>
      </div>
      <div class="quote-box">
        "ระบบออกบัตรคิวไวดีครับ อยากให้เพิ่มเมนูร้านน้ำและเครื่องดื่ม ชา กาแฟ ในโรงอาหารเพิ่มอีกหลายๆ ร้าน เพราะช่วงเที่ยงร้านน้ำคิวยาวไม่แพ้ร้านข้าวเลยครับ"
        <div class="quote-author">— ผู้ประเมิน #03 (นักศึกษา AI ชั้นปีที่ 2)</div>
      </div>
      <p style="margin: 0; font-size: 11.5px; color: #475569;">
        <strong>การวิเคราะห์ของกลุ่ม:</strong> ปัจจุบันระบบเน้นไปที่ร้านอาหารจานหลัก แต่พฤติกรรมของนักศึกษาในโรงอาหารมักจะซื้อข้าวคู่กับน้ำดื่ม การเพิ่มร้านเครื่องดื่มและของว่างจะช่วยให้เกิดการสั่งซื้อแบบครบวงจร (One-stop Dining Order)
      </p>
    </div>

    <!-- มิติที่ 2 -->
    <div class="content-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <h3 style="margin: 0;">มิติที่ 2: การขยายขอบเขตการใช้งานรอบรั้วมหาวิทยาลัย (Campus Ecosystem Reach)</h3>
        <span class="highlight-tag tag-blue">คำขอเชิงพื้นที่</span>
      </div>
      <div class="quote-box">
        "โดยรวมถือว่าตอบโจทย์ชีวิตเด็กหอแถวกังสดาลมากครับ ถ้าเชื่อมกับร้านค้ารอบรั้ว มข. เช่น โซนกังสดาล และหลังมอ ได้หมดจะดีมากเลย จะได้สั่งตอนกำลังเดินออกจากหอ"
        <div class="quote-author">— ผู้ประเมิน #05 (นักศึกษา AI ชั้นปีที่ 3)</div>
      </div>
      <p style="margin: 0; font-size: 11.5px; color: #475569;">
        <strong>การวิเคราะห์ของกลุ่ม:</strong> ปัญหารถติดและที่จอดรถบริเวณโซนหอพักรอบมหาวิทยาลัยขอนแก่นเป็นอุปสรรคสำคัญ หากขยายระบบ QueueUp ไปยังร้านค้าเอกชนรอบรั้วมหาวิทยาลัย จะสร้างมูลค่าเพิ่มมหาศาลให้กับชุมชนนักศึกษา
      </p>
    </div>

    <!-- มิติที่ 3 -->
    <div class="content-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <h3 style="margin: 0;">มิติที่ 3: ระบบแจ้งเตือนเสียง Chime และสิทธิความเป็นส่วนตัว (Sound Chime & Privacy)</h3>
        <span class="highlight-tag tag-green">คำชมเชยด้าน UX / Security</span>
      </div>
      <div class="quote-box">
        "ใช้ง่ายมากค่ะ ระบบแจ้งเตือนเสียง Chime ตอนอาหารพร้อมรับทำให้ไม่ต้องคอยจ้องหน้าจอมือถือตลอดเวลา และมีระบบ PDPA แจ้งเตือนภูมิแพ้ชัดเจน ทำให้มั่นใจในการสั่งทาน"
        <div class="quote-author">— ผู้ประเมิน #04 (นักศึกษา AI ชั้นปีที่ 1) และ #07 (นศ. AI ปี 2)</div>
      </div>
      <p style="margin: 0; font-size: 11.5px; color: #475569;">
        <strong>การวิเคราะห์ของกลุ่ม:</strong> ฟังก์ชันเสียงเตือนและระบบแจ้งเตือนส่วนผสมที่อาจก่อให้เกิดอาการแพ้ (Allergy Guard) ได้รับการตอบรับที่ดีเยี่ยม ควรยึดเป็นมาตรฐานหลักและต่อยอดการแจ้งเตือนไปยัง Web Push Notification
      </p>
    </div>

    <div class="doc-footer">
      <span>เอกสารส่งงานวิชา GE341511 โครงการพัฒนา QueueUp • กลุ่ม 23</span>
      <span>หน้า 3 จาก 4</span>
    </div>
  </div>


  <!-- =======================================================================
       PAGE 4: แผนการพัฒนาแอปพลิเคชันของตนเองต่อไป
       ======================================================================= -->
  <div class="page">
    <div class="doc-header">
      <div class="brand">QueueUp Future Product Roadmap</div>
      <div class="course-info">ส่วนที่ 3: แผนการพัฒนาแอปพลิเคชันของตนเองต่อไป • GE341511</div>
    </div>

    <div class="section-title">
      <span>3. แผนการพัฒนาแอปพลิเคชันของตนเองต่อไป (Future Application Roadmap)</span>
      <span class="en-sub">Actionable Development Phases</span>
    </div>

    <p style="margin-top: 0; color: #475569; font-size: 12px;">
      จากผลการประเมิน ข้อเสนอแนะ และการสังเกตพฤติกรรมผู้ใช้งานจริง กลุ่มที่ 23 ได้จัดทำแผนผังกลยุทธ์การพัฒนาต่อเนื่อง (Product Roadmap) แบ่งออกเป็น 3 ระยะหลัก เพื่อยกระดับ QueueUp สู่แอปพลิเคชันต้นแบบอัจฉริยะประจำมหาวิทยาลัย:
    </p>

    <!-- Phase 1 -->
    <div class="roadmap-phase" style="border-left-color: #ea580c;">
      <div class="phase-header">
        <div class="phase-title">ระยะที่ 1: การตอบสนองข้อเสนอแนะทันที (Immediate Enhancements)</div>
        <div class="phase-time">เดือนที่ 1 - 2 (Q4 2026)</div>
      </div>
      <p style="margin: 0 0 6px 0; font-size: 12px; color: #334155;">
        <strong>เป้าหมายหลัก:</strong> อัปเกรดระบบเพื่อตอบสนองความต้องการที่ได้รับจากแบบสอบถามโดยตรง
      </p>
      <ul style="margin: 0; padding-left: 18px; font-size: 11.5px; color: #475569; line-height: 1.5;">
        <li><strong>ขยายประเภทร้านค้าสู่เครื่องดื่มและของหวาน:</strong> เพิ่ม Category สำหรับร้านน้ำ ชานมไข่มุก และกาแฟในโรงอาหารคอมพิวเตอร์อย่างน้อย 3 ร้านค้า</li>
        <li><strong>ระบบจัดคิวแบบ Multi-Store Order:</strong> เพิ่มฟังก์ชันสั่งอาหารจานหลักพร้อมเครื่องดื่มในรอบเดียว โดยระบบแยกบัตรคิวให้อัตโนมัติ (เช่น Q-Rice-012 และ Q-Drink-008)</li>
        <li><strong>รองรับ Web Push Notifications:</strong> พัฒนา Service Worker แจ้งเตือนสเตตัสอาหารพร้อมรับแม้ขณะปิดหน้าจอหรือสลับแอป</li>
      </ul>
    </div>

    <!-- Phase 2 -->
    <div class="roadmap-phase" style="border-left-color: #0284c7;">
      <div class="phase-header">
        <div class="phase-title">ระยะที่ 2: การขยายเครือข่ายรอบรั้วมหาวิทยาลัย (Campus Ecosystem Expansion)</div>
        <div class="phase-time">เดือนที่ 3 - 5 (Q1 2027)</div>
      </div>
      <p style="margin: 0 0 6px 0; font-size: 12px; color: #334155;">
        <strong>เป้าหมายหลัก:</strong> เชื่อมต่อร้านค้ารอบมหาวิทยาลัยและพัฒนาระบบสำหรับผู้ประกอบการ
      </p>
      <ul style="margin: 0; padding-left: 18px; font-size: 11.5px; color: #475569; line-height: 1.5;">
        <li><strong>ขยายสู่โรงอาหารศูนย์อาหารคอมเพล็กซ์ (Complex) และโซนกังสดาล:</strong> นำร่องขยายจุดรับคิวดิจิทัลไปยังร้านค้าพันธมิตรรอบ มข. 15 ร้านค้า</li>
        <li><strong>Merchant Kitchen Display System (KDS) แบบเต็มรูปแบบ:</strong> อัปเกรดหน้าจอครัวให้ร้านค้าจัดคิวตามประเภทวัตถุดิบ ลดเวลาปรุงอาหารลง 25%</li>
        <li><strong>ระบบจองช่วงเวลารับประทาน (Table Slot Booking):</strong> เชื่อมโยงการจองโต๊ะอาหารพร้อมการสั่งคิวล่วงหน้า เพื่อการันตีที่นั่งในช่วงเวลาเร่งด่วน</li>
      </ul>
    </div>

    <!-- Phase 3 -->
    <div class="roadmap-phase" style="border-left-color: #10b981;">
      <div class="phase-header">
        <div class="phase-title">ระยะที่ 3: ระบบปัญญาประดิษฐ์อัจฉริยะและการทำนาย (AI & Predictive Analytics)</div>
        <div class="phase-time">เดือนที่ 6 เป็นต้นไป (Q2 2027)</div>
      </div>
      <p style="margin: 0 0 6px 0; font-size: 12px; color: #334155;">
        <strong>เป้าหมายหลัก:</strong> นำองค์ความรู้ด้าน AI & Data Analytics มายกระดับระบบให้เป็น Smart Canteen
      </p>
      <ul style="margin: 0; padding-left: 18px; font-size: 11.5px; color: #475569; line-height: 1.5;">
        <li><strong>โมเดลทำนายเวลารอคิวแม่นยำสูง (AI Queue Wait Time Prediction):</strong> วิเคราะห์ข้อมูลย้อนหลังตามสภาพอากาศ ชั่วโมงเรียน และเมนูที่สั่ง เพื่อคำนวณเวลาทำอาหารที่เที่ยงตรง</li>
        <li><strong>ระบบผู้ช่วยแนะนำเมนูอาหาร (AI Personalized Meal Assistant):</strong> แนะนำเมนูตามคุณค่าทางโภชนาการ ประวัติการแพ้อาหาร และงบประมาณของนักศึกษา</li>
        <li><strong>Merchant Smart Inventory Reordering:</strong> ระบบวิเคราะห์แนวโน้มวัตถุดิบและแจ้งเตือนร้านค้าให้เตรียมของสดล่วงหน้า ลดปัญหาอาหารหมดสต็อก</li>
      </ul>
    </div>

    <!-- Sign-off card -->
    <div style="margin-top: 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 12px; font-weight: 700; color: #0f172a;">คณะผู้จัดทำ โครงการ QueueUp (กลุ่มที่ 23)</div>
        <div style="font-size: 10.5px; color: #64748b;">วิทยาลัยการคอมพิวเตอร์ สาขาวิชาปัญญาประดิษฐ์ (AI) มหาวิทยาลัยขอนแก่น</div>
      </div>
      <div style="text-align: right; font-size: 10.5px; color: #ea580c; font-weight: 700;">
        รายวิชา GE341511 ภาคการศึกษา 1/2569
      </div>
    </div>

    <div class="doc-footer">
      <span>เอกสารส่งงานวิชา GE341511 โครงการพัฒนา QueueUp • กลุ่ม 23</span>
      <span>หน้า 4 จาก 4</span>
    </div>
  </div>

</body>
</html>
"""

html_path = os.path.join(secure_dir, "QueueUp_Evaluation_Report_GE341511.html")
pdf_path = os.path.join(secure_dir, "QueueUp_Evaluation_Dashboard_and_Report_GE341511.pdf")
docs_pdf_path = os.path.join(docs_backup_dir, "QueueUp_Evaluation_Dashboard_and_Report_GE341511.pdf")

print(f"Writing HTML report to {html_path}...")
with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"Rendering PDF with Edge Headless to {pdf_path}...")
edge_exe = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
html_url = f"file:///{html_path.replace(os.sep, '/')}"

cmd = [
    edge_exe,
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={pdf_path}",
    html_url
]

subprocess.run(cmd, check=True)

if os.path.exists(pdf_path):
    print(f"SUCCESS! PDF created: {pdf_path} ({os.path.getsize(pdf_path):,} bytes)")
    shutil.copyfile(pdf_path, docs_pdf_path)
    print(f"Backup copy saved to Documents: {docs_pdf_path}")
    
    # Also update the secure zip archive
    archive_path = os.path.join(secure_dir, "QueueUp_Evaluation_Secured_Archive.zip")
    docs_archive_path = os.path.join(docs_backup_dir, "QueueUp_Evaluation_Secured_Archive.zip")
    if os.path.exists(archive_path):
        import zipfile
        with zipfile.ZipFile(archive_path, 'a', zipfile.ZIP_DEFLATED) as zf:
            zf.write(pdf_path, arcname=os.path.basename(pdf_path))
        shutil.copyfile(archive_path, docs_archive_path)
        print(f"Updated secure archive with PDF.")
else:
    print("Error: PDF was not generated!")
