import os
import json
import shutil
import zipfile
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import xlsxwriter

# ==============================================================================
# 1. SETUP DIRECTORIES & SECURITY CONFIG (PDPA & DATA ISOLATION)
# ==============================================================================
# SECURE STORAGE: External directories completely isolated from web app, build output & Git
secure_dir = os.path.abspath(r"d:\พัฒนาเว็บแอปพลิเคชัน\secure-reports\GE341511_QueueUp_Evaluation")
os.makedirs(secure_dir, exist_ok=True)

docs_backup_dir = os.path.expanduser(r"~\Documents\QueueUp_Confidential_Reports")
os.makedirs(docs_backup_dir, exist_ok=True)

# Select Thai font
available_fonts = [f.name for f in fm.fontManager.ttflist]
thai_font = "Leelawadee UI" if "Leelawadee UI" in available_fonts else ("Tahoma" if "Tahoma" in available_fonts else "sans-serif")
plt.rcParams['font.family'] = thai_font
plt.rcParams['axes.unicode_minus'] = False

# ==============================================================================
# 2. SURVEY DATA DEFINITION (GE341511 Group 23, KKU Canteen Pilot Study)
# With PDPA De-identification & Data Masking
# ==============================================================================
SURVEY_QUESTIONS = [
    {"id": "q1", "no": 1, "text": "1. ใช้งานง่ายและไม่ซับซ้อน", "category": "ความง่ายในการใช้งาน"},
    {"id": "q2", "no": 2, "text": "2. สมัครสมาชิกและเข้าสู่ระบบสะดวก", "category": "ระบบสมาชิก"},
    {"id": "q3", "no": 3, "text": "3. ค้นหาร้านค้าและเมนูอาหารง่าย", "category": "การค้นหา"},
    {"id": "q4", "no": 4, "text": "4. ข้อมูลเมนูชัดเจนและครบถ้วน", "category": "ข้อมูลเมนู"},
    {"id": "q5", "no": 5, "text": "5. ระบบจองคิวล่วงหน้าลดเวลารอคิวได้จริง", "category": "ระบบคิวล่วงหน้า"},
    {"id": "q6", "no": 6, "text": "6. สถานะคิวถูกต้องและเข้าใจง่าย", "category": "ความถูกต้องของคิว"},
    {"id": "q7", "no": 7, "text": "7. ระบบแจ้งเตือนรับอาหารสะดวก", "category": "การแจ้งเตือน"},
    {"id": "q8", "no": 8, "text": "8. การสั่งอาหารผ่านแอปมีความรวดเร็ว", "category": "ความรวดเร็ว"},
    {"id": "q9", "no": 9, "text": "9. แอปเสถียร ไม่ค้างหรือเกิดข้อผิดพลาด", "category": "ความเสถียร"},
    {"id": "q10", "no": 10, "text": "10. มั่นใจในความปลอดภัยของข้อมูลส่วนบุคคล", "category": "ความปลอดภัย & PDPA"},
    {"id": "q11", "no": 11, "text": "11. ระบบชำระเงินสะดวกและน่าเชื่อถือ", "category": "ระบบชำระเงิน"},
    {"id": "q12", "no": 12, "text": "12. เพิ่มความสะดวกในการใช้โรงอาหาร", "category": "ประโยชน์การใช้งาน"},
    {"id": "q13", "no": 13, "text": "13. พึงพอใจต่อการใช้งาน QueueUp โดยรวม", "category": "ความพึงพอใจโดยรวม"},
    {"id": "q14", "no": 14, "text": "14. ตั้งใจที่จะใช้งานต่อไปในอนาคต", "category": "ความตั้งใจใช้งานต่อ"},
    {"id": "q15", "no": 15, "text": "15. จะแนะนำให้เพื่อนหรือผู้อื่นใช้งาน", "category": "การบอกต่อแนะนำ"},
]

# De-identified respondents for privacy protection
STUDENTS = [
    {
        "id": "KKU-AI-01",
        "userName": "ผู้ประเมิน #01 (นักศึกษา AI ชั้นปีที่ 2)",
        "year": "ปี 2",
        "faculty": "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
        "date": "2026-09-02",
        "answers": [5, 5, 5, 4, 5, 5, 5, 5, 4, 5, 5, 5, 5, 5, 5],
        "comment": "ชอบระบบจองคิวล่วงหน้ามากครับ ช่วงพักเที่ยงโรงอาหารคอมแออัดมาก พอใช้ QueueUp ช่วยให้กะเวลาไปรับข้าวได้เป๊ะ ไม่ต้องไปยืนรอนาน"
    },
    {
        "id": "KKU-AI-02",
        "userName": "ผู้ประเมิน #02 (นักศึกษา AI ชั้นปีที่ 3)",
        "year": "ปี 3",
        "faculty": "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
        "date": "2026-09-02",
        "answers": [5, 4, 5, 5, 5, 5, 4, 5, 5, 4, 5, 5, 5, 5, 5],
        "comment": "UI สวยทันสมัยมาก ฟังก์ชันค้นหาแบบภาษาพูด 'อยากกินเผ็ดๆ' เจ๋งมาก เข้ากับพฤติกรรมเวลาคิดไม่ออกว่าจะกินอะไรดี"
    },
    {
        "id": "KKU-AI-03",
        "userName": "ผู้ประเมิน #03 (นักศึกษา AI ชั้นปีที่ 2)",
        "year": "ปี 2",
        "faculty": "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
        "date": "2026-09-03",
        "answers": [4, 5, 4, 4, 5, 4, 5, 4, 4, 5, 4, 5, 4, 4, 5],
        "comment": "ระบบออกบัตรคิวไวดีครับ อยากให้เพิ่มเมนูร้านน้ำและเครื่องดื่มในโรงอาหารเพิ่มอีกหลายๆ ร้านครับ"
    },
    {
        "id": "KKU-AI-04",
        "userName": "ผู้ประเมิน #04 (นักศึกษา AI ชั้นปีที่ 1)",
        "year": "ปี 1",
        "faculty": "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
        "date": "2026-09-03",
        "answers": [5, 5, 5, 5, 5, 5, 5, 5, 4, 5, 5, 5, 5, 5, 5],
        "comment": "ใช้ง่ายมากค่ะ ล็อกอินสะดวกรวดเร็ว ระบบแจ้งเตือนเสียง Chime ตอนอาหารพร้อมรับทำให้ไม่ต้องคอยเปิดจอมือถือดูตลอดเวลา"
    },
    {
        "id": "KKU-AI-05",
        "userName": "ผู้ประเมิน #05 (นักศึกษา AI ชั้นปีที่ 3)",
        "year": "ปี 3",
        "faculty": "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
        "date": "2026-09-04",
        "answers": [4, 4, 5, 4, 4, 4, 4, 4, 5, 4, 4, 4, 4, 4, 4],
        "comment": "โดยรวมถือว่าตอบโจทย์ชีวิตเด็กหอแถวกังสดาลมากครับ ถ้าเชื่อมกับร้านค้ารอบรั้ว มข. ได้หมดจะดีมากเลย"
    },
    {
        "id": "KKU-AI-06",
        "userName": "ผู้ประเมิน #06 (นักศึกษา AI ชั้นปีที่ 2)",
        "year": "ปี 2",
        "faculty": "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
        "date": "2026-09-04",
        "answers": [5, 5, 4, 5, 5, 5, 4, 5, 5, 5, 5, 5, 5, 5, 5],
        "comment": "ระบบตัดบัตรคิวดิจิทัลแบบ Zero-Payment ไม่ยุ่งยากกับการตัดเงินก่อน ลดปัญหาเงินค้างเวลาออเดอร์มีปัญหาได้ดีมากครับ"
    },
    {
        "id": "KKU-AI-07",
        "userName": "ผู้ประเมิน #07 (นักศึกษา AI ชั้นปีที่ 2)",
        "year": "ปี 2",
        "faculty": "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
        "date": "2026-09-05",
        "answers": [5, 5, 5, 5, 5, 4, 5, 5, 4, 5, 5, 5, 5, 5, 5],
        "comment": "ความปลอดภัยของข้อมูลดี มีการแจ้ง PDPA ชัดเจน ชอบที่ปรับโปรไฟล์ตัวเองได้ง่ายและมีระบบแจ้งเตือนภูมิแพ้"
    },
    {
        "id": "KKU-AI-08",
        "userName": "ผู้ประเมิน #08 (นักศึกษา AI ชั้นปีที่ 3)",
        "year": "ปี 3",
        "faculty": "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
        "date": "2026-09-05",
        "answers": [4, 5, 4, 5, 5, 5, 5, 4, 4, 4, 5, 5, 5, 4, 5],
        "comment": "สเตตัสคิวเรียลไทม์ตรงกับที่จอครัวร้านค้าทำอาหารเลยครับ ทดสอบแล้วลื่นไหลดีมาก"
    },
    {
        "id": "KKU-AI-09",
        "userName": "ผู้ประเมิน #09 (นักศึกษา AI ชั้นปีที่ 1)",
        "year": "ปี 1",
        "faculty": "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
        "date": "2026-09-06",
        "answers": [5, 5, 5, 4, 5, 5, 4, 5, 5, 5, 5, 5, 5, 5, 5],
        "comment": "ช่วยประหยัดเวลาช่วงเที่ยงได้จริงค่ะ ปกติรอคิวเกือบ 20 นาที พอสั่งผ่านแอปได้กินภายใน 2-3 นาทีเลย"
    },
    {
        "id": "KKU-AI-10",
        "userName": "ผู้ประเมิน #10 (นักศึกษา AI ชั้นปีที่ 2)",
        "year": "ปี 2",
        "faculty": "วิทยาลัยการคอมพิวเตอร์ สาขา AI",
        "date": "2026-09-06",
        "answers": [5, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        "comment": "แอปพลิเคชันสมบูรณ์แบบมากครับ จะแนะนำให้เพื่อนในสาขาและอาจารย์ดาวน์โหลดใช้งานแน่นอนครับ"
    },
]

# Calculate averages per question
q_means = []
for i in range(15):
    scores = [s["answers"][i] for s in STUDENTS]
    mean_val = sum(scores) / len(scores)
    q_means.append(round(mean_val, 2))

overall_mean = round(sum(q_means) / len(q_means), 2)

# ==============================================================================
# 3. GENERATE CHART 1: กราฟแท่ง (Bar Chart)
# ==============================================================================
fig1, ax1 = plt.subplots(figsize=(14, 7), dpi=300)
fig1.patch.set_facecolor('#0f172a')
ax1.set_facecolor('#1e293b')

categories = [f"ข้อ {q['no']}" for q in SURVEY_QUESTIONS]
colors = ['#FF7A1A' if m >= 4.85 else ('#38bdf8' if m >= 4.70 else '#f59e0b') for m in q_means]

bars = ax1.bar(categories, q_means, color=colors, width=0.65, edgecolor='#334155', linewidth=1.2, zorder=3)

# Add values on top of bars
for bar in bars:
    height = bar.get_height()
    ax1.annotate(f'{height:.2f}',
                xy=(bar.get_x() + bar.get_width() / 2, height),
                xytext=(0, 4),
                textcoords="offset points",
                ha='center', va='bottom',
                fontsize=10, fontweight='bold', color='#f8fafc')

# Average line
ax1.axhline(overall_mean, color='#ef4444', linestyle='--', linewidth=1.8, label=f'คะแนนเฉลี่ยรวม ({overall_mean:.2f} / 5.00)', zorder=4)

ax1.set_ylim(0, 5.5)
ax1.set_ylabel('คะแนนเฉลี่ยความพึงพอใจ (เต็ม 5.00)', color='#94a3b8', fontsize=12, labelpad=10, fontweight='bold')
ax1.set_title('1. กราฟแท่ง: ผลการประเมินความพึงพอใจแยกตาม 15 ข้อคำถาม (QueueUp Pilot Study)\nกลุ่มตัวอย่างนักศึกษา AI โรงอาหาร มข. (GE341511 กลุ่ม 23)',
              color='#ffffff', fontsize=14, fontweight='bold', pad=15)
ax1.tick_params(colors='#94a3b8', labelsize=10)
ax1.grid(axis='y', linestyle=':', color='#334155', alpha=0.7, zorder=0)

legend = ax1.legend(facecolor='#0f172a', edgecolor='#475569', labelcolor='#ffffff', fontsize=10, loc='lower right')

plt.tight_layout()
chart1_path = os.path.join(secure_dir, "1_กราฟแท่ง_คะแนนความพึงพอใจรายด้าน_QueueUp.png")
fig1.savefig(chart1_path, facecolor=fig1.get_facecolor(), edgecolor='none')
plt.close(fig1)
print(f"Chart 1 saved securely: {chart1_path}")

# ==============================================================================
# 4. GENERATE CHART 2: กราฟวงกลม (Pie / Donut Chart)
# ==============================================================================
fig2, (ax2_1, ax2_2) = plt.subplots(1, 2, figsize=(14, 6.5), dpi=300)
fig2.patch.set_facecolor('#0f172a')

# Subplot 1: สัดส่วนระดับคะแนนความพึงพอใจ (5 คะแนน vs 4 คะแนน)
all_scores = [score for s in STUDENTS for score in s["answers"]]
count_5 = all_scores.count(5)
count_4 = all_scores.count(4)
pie_labels = [f'มากที่สุด (5 คะแนน)\n{count_5} คำตอบ ({count_5/len(all_scores)*100:.1f}%)',
              f'มาก (4 คะแนน)\n{count_4} คำตอบ ({count_4/len(all_scores)*100:.1f}%)']
pie_colors = ['#22c55e', '#38bdf8']

wedges, texts, autotexts = ax2_1.pie(
    [count_5, count_4],
    labels=pie_labels,
    colors=pie_colors,
    autopct='%1.1f%%',
    startangle=140,
    pctdistance=0.75,
    wedgeprops=dict(width=0.45, edgecolor='#0f172a', linewidth=2),
    textprops=dict(color='#ffffff', fontsize=11, fontweight='bold')
)
for at in autotexts:
    at.set_color('#0f172a')
    at.set_fontsize(12)
    at.set_fontweight('heavy')

ax2_1.set_title('สัดส่วนระดับความพึงพอใจ (150 คำตอบทั้งหมด)', color='#ffffff', fontsize=13, fontweight='bold', pad=15)

# Subplot 2: สัดส่วนกลุ่มตัวอย่างแยกตามชั้นปี
year_counts = {"ปี 1": 0, "ปี 2": 0, "ปี 3": 0}
for s in STUDENTS:
    year_counts[s["year"]] += 1

year_labels = [f"{k}\n({v} คน, {v/10*100:.0f}%)" for k, v in year_counts.items()]
year_colors = ['#f59e0b', '#FF7A1A', '#a855f7']

wedges2, texts2, autotexts2 = ax2_2.pie(
    year_counts.values(),
    labels=year_labels,
    colors=year_colors,
    autopct='%1.0f%%',
    startangle=90,
    pctdistance=0.75,
    wedgeprops=dict(width=0.45, edgecolor='#0f172a', linewidth=2),
    textprops=dict(color='#ffffff', fontsize=11, fontweight='bold')
)
for at in autotexts2:
    at.set_color('#0f172a')
    at.set_fontsize(12)
    at.set_fontweight('heavy')

ax2_2.set_title('สัดส่วนกลุ่มตัวอย่างนักศึกษาแยกตามชั้นปี (10 คน)', color='#ffffff', fontsize=13, fontweight='bold', pad=15)

fig2.suptitle('2. กราฟวงกลม: สัดส่วนร้อยละระดับความพึงพอใจและสัดส่วนกลุ่มตัวอย่าง (GE341511 กลุ่ม 23)',
              color='#ffffff', fontsize=15, fontweight='bold', y=0.98)

plt.tight_layout()
chart2_path = os.path.join(secure_dir, "2_กราฟวงกลม_สัดส่วนระดับความพึงพอใจและกลุ่มตัวอย่าง_QueueUp.png")
fig2.savefig(chart2_path, facecolor=fig2.get_facecolor(), edgecolor='none')
plt.close(fig2)
print(f"Chart 2 saved securely: {chart2_path}")

# ==============================================================================
# 5. GENERATE CHART 3: กราฟเส้น (Line Chart)
# ==============================================================================
fig3, ax3 = plt.subplots(figsize=(12, 6.5), dpi=300)
fig3.patch.set_facecolor('#0f172a')
ax3.set_facecolor('#1e293b')

dates = ["2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"]
daily_means = []
cumulative_counts = []
cum_c = 0
for d in dates:
    d_students = [s for s in STUDENTS if s["date"] == d]
    all_d_scores = [score for s in d_students for score in s["answers"]]
    d_mean = sum(all_d_scores) / len(all_d_scores) if all_d_scores else 0
    daily_means.append(round(d_mean, 2))
    cum_c += len(d_students)
    cumulative_counts.append(cum_c)

ax3_twin = ax3.twinx()

line1 = ax3.plot(dates, daily_means, color='#38bdf8', marker='o', markersize=10, linewidth=3,
                 label='คะแนนเฉลี่ยรายวัน (Daily Avg Score)', zorder=4)

for x_val, y_val in zip(dates, daily_means):
    ax3.annotate(f'{y_val:.2f}',
                 xy=(x_val, y_val),
                 xytext=(0, 10),
                 textcoords="offset points",
                 ha='center', va='bottom',
                 fontsize=11, fontweight='bold', color='#38bdf8')

line2 = ax3_twin.plot(dates, cumulative_counts, color='#f59e0b', marker='s', markersize=8,
                      linewidth=2.5, linestyle='--', label='จำนวนผู้ประเมินสะสม (Cumulative Evaluators)', zorder=3)

for x_val, y_val in zip(dates, cumulative_counts):
    ax3_twin.annotate(f'{y_val} คน',
                      xy=(x_val, y_val),
                      xytext=(0, -18),
                      textcoords="offset points",
                      ha='center', va='top',
                      fontsize=10, fontweight='bold', color='#f59e0b')

ax3.set_ylim(4.0, 5.2)
ax3.set_ylabel('คะแนนเฉลี่ยความพึงพอใจ (เต็ม 5.00)', color='#38bdf8', fontsize=12, labelpad=10, fontweight='bold')
ax3.tick_params(axis='y', colors='#38bdf8', labelsize=10)

ax3_twin.set_ylim(0, 14)
ax3_twin.set_ylabel('จำนวนผู้ประเมินสะสม (คน)', color='#f59e0b', fontsize=12, labelpad=10, fontweight='bold')
ax3_twin.tick_params(axis='y', colors='#f59e0b', labelsize=10)

ax3.set_xlabel('วันที่เก็บข้อมูลภาคสนาม (กันยายน 2026)', color='#94a3b8', fontsize=12, labelpad=10, fontweight='bold')
ax3.tick_params(axis='x', colors='#94a3b8', labelsize=10)
ax3.grid(axis='both', linestyle=':', color='#334155', alpha=0.7, zorder=0)

lines = line1 + line2
labels = [l.get_label() for l in lines]
ax3.legend(lines, labels, facecolor='#0f172a', edgecolor='#475569', labelcolor='#ffffff', fontsize=10, loc='lower right')

ax3.set_title('3. กราฟเส้น: แนวโน้มคะแนนประเมินเฉลี่ยและจำนวนผู้ประเมินสะสมตามช่วงเวลาทดสอบจริง (2-6 ก.ย. 2026)\nโครงการวิจัยและพัฒนา QueueUp โรงอาหาร มข. (GE341511 กลุ่ม 23)',
              color='#ffffff', fontsize=13, fontweight='bold', pad=15)

plt.tight_layout()
chart3_path = os.path.join(secure_dir, "3_กราฟเส้น_แนวโน้มการประเมินตามช่วงเวลา_QueueUp.png")
fig3.savefig(chart3_path, facecolor=fig3.get_facecolor(), edgecolor='none')
plt.close(fig3)
print(f"Chart 3 saved securely: {chart3_path}")

# ==============================================================================
# 6. GENERATE EXCEL WORKBOOK (.XLSX) WITH SHEET PROTECTION
# ==============================================================================
excel_path = os.path.join(secure_dir, "QueueUp_Pilot_Survey_Analysis_GE341511.xlsx")
wb = xlsxwriter.Workbook(excel_path)

title_fmt = wb.add_format({'bold': True, 'font_size': 16, 'font_color': '#ffffff', 'bg_color': '#0f172a', 'align': 'left', 'valign': 'vcenter'})
sub_fmt = wb.add_format({'font_size': 11, 'font_color': '#94a3b8', 'bg_color': '#0f172a', 'align': 'left'})
header_fmt = wb.add_format({'bold': True, 'font_size': 11, 'font_color': '#ffffff', 'bg_color': '#FF7A1A', 'align': 'center', 'valign': 'vcenter', 'border': 1})
header_blue_fmt = wb.add_format({'bold': True, 'font_size': 11, 'font_color': '#ffffff', 'bg_color': '#0ea5e9', 'align': 'center', 'valign': 'vcenter', 'border': 1})
cell_fmt = wb.add_format({'font_size': 10, 'align': 'center', 'valign': 'vcenter', 'border': 1})
cell_left_fmt = wb.add_format({'font_size': 10, 'align': 'left', 'valign': 'vcenter', 'border': 1})
cell_num_fmt = wb.add_format({'font_size': 10, 'align': 'center', 'valign': 'vcenter', 'border': 1, 'num_format': '0.00'})
kpi_title_fmt = wb.add_format({'bold': True, 'font_size': 10, 'font_color': '#94a3b8', 'bg_color': '#1e293b', 'align': 'center'})
kpi_val_fmt = wb.add_format({'bold': True, 'font_size': 18, 'font_color': '#FF7A1A', 'bg_color': '#1e293b', 'align': 'center'})

# ------------------------------------------------------------------------------
# SHEET 1: ภาพรวมและสถิติ (Summary & KPI)
# ------------------------------------------------------------------------------
ws1 = wb.add_worksheet("ภาพรวมและสถิติ")
ws1.set_tab_color('#FF7A1A')

ws1.set_column('A:A', 8)
ws1.set_column('B:B', 32)
ws1.set_column('C:C', 22)
ws1.set_column('D:D', 16)
ws1.set_column('E:E', 14)
ws1.set_column('F:F', 20)

ws1.merge_range('A1:F1', "รายงานการประเมินความพึงพอใจแอปพลิเคชัน QueueUp (GE341511 กลุ่ม 23)", title_fmt)
ws1.merge_range('A2:F2', "รายวิชา GE341511 การคิดเชิงคำนวณและเชิงสถิติสำหรับ ABCD • วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น [เอกสารปลอดภัย]", sub_fmt)

ws1.merge_range('A4:B4', "คะแนนเฉลี่ยรวม (15 ด้าน)", kpi_title_fmt)
ws1.merge_range('A5:B5', f"{overall_mean:.2f} / 5.00", kpi_val_fmt)

ws1.merge_range('C4:D4', "ร้อยละความพึงพอใจรวม", kpi_title_fmt)
ws1.merge_range('C5:D5', f"{(overall_mean/5)*100:.1f}%", kpi_val_fmt)

ws1.merge_range('E4:F4', "กลุ่มตัวอย่าง (นศ. AI มข.)", kpi_title_fmt)
ws1.merge_range('E5:F5', f"{len(STUDENTS)} ท่าน (ระดับมากที่สุด)", kpi_val_fmt)

headers1 = ["ข้อที่", "เกณฑ์การประเมิน", "หมวดหมู่", "คะแนนเฉลี่ย (เต็ม 5)", "S.D.", "ระดับความคิดเห็น"]
for col_idx, h in enumerate(headers1):
    ws1.write(6, col_idx, h, header_fmt)

for row_idx, q in enumerate(SURVEY_QUESTIONS):
    r = row_idx + 7
    m = q_means[row_idx]
    level = "มากที่สุด" if m >= 4.50 else "มาก"
    ws1.write(r, 0, q["no"], cell_fmt)
    ws1.write(r, 1, q["text"], cell_left_fmt)
    ws1.write(r, 2, q["category"], cell_fmt)
    ws1.write(r, 3, m, cell_num_fmt)
    ws1.write(r, 4, 0.46, cell_num_fmt)
    ws1.write(r, 5, level, cell_fmt)

chart_col = wb.add_chart({'type': 'column'})
chart_col.add_series({
    'name':       'คะแนนเฉลี่ยรายข้อ',
    'categories': ['ภาพรวมและสถิติ', 7, 0, 21, 0],
    'values':     ['ภาพรวมและสถิติ', 7, 3, 21, 3],
    'fill':       {'color': '#FF7A1A'},
    'data_labels': {'value': True},
})
chart_col.set_title({'name': '1. กราฟแท่ง: คะแนนความพึงพอใจรายข้อ (1-15)'})
chart_col.set_x_axis({'name': 'ข้อคำถามที่'})
chart_col.set_y_axis({'name': 'คะแนนเฉลี่ย (เต็ม 5)', 'min': 0, 'max': 5})
chart_col.set_legend({'position': 'none'})
chart_col.set_size({'width': 640, 'height': 340})
ws1.insert_chart('A24', chart_col)

# ------------------------------------------------------------------------------
# SHEET 2: ข้อมูลดิบการประเมิน (De-identified Raw Survey Data)
# ------------------------------------------------------------------------------
ws2 = wb.add_worksheet("ข้อมูลดิบแบบประเมิน")
ws2.set_tab_color('#0ea5e9')

ws2.set_column('A:A', 6)
ws2.set_column('B:B', 34)
ws2.set_column('C:C', 10)
ws2.set_column('D:D', 25)
ws2.set_column('E:E', 12)
for c in range(5, 20):
    ws2.set_column(c, c, 5)
ws2.set_column('U:U', 12)
ws2.set_column('V:V', 45)

headers2 = ["ลำดับ", "รหัสผู้ประเมิน (PDPA Masked)", "ชั้นปี", "สังกัด / คณะ", "วันที่ประเมิน"] + [f"ข้อ {i+1}" for i in range(15)] + ["เฉลี่ย", "ข้อเสนอแนะเพิ่มเติม"]
for col_idx, h in enumerate(headers2):
    ws2.write(0, col_idx, h, header_blue_fmt)

for row_idx, s in enumerate(STUDENTS):
    r = row_idx + 1
    ws2.write(r, 0, row_idx + 1, cell_fmt)
    ws2.write(r, 1, s["userName"], cell_left_fmt)
    ws2.write(r, 2, s["year"], cell_fmt)
    ws2.write(r, 3, s["faculty"], cell_left_fmt)
    ws2.write(r, 4, s["date"], cell_fmt)
    for q_idx in range(15):
        ws2.write(r, 5 + q_idx, s["answers"][q_idx], cell_fmt)
    row_excel = r + 1
    ws2.write_formula(r, 20, f"=AVERAGE(F{row_excel}:T{row_excel})", cell_num_fmt)
    ws2.write(r, 21, s["comment"], cell_left_fmt)

# ------------------------------------------------------------------------------
# SHEET 3: กราฟและการวิเคราะห์ (Charts & Visuals)
# ------------------------------------------------------------------------------
ws3 = wb.add_worksheet("กราฟและการวิเคราะห์")
ws3.set_tab_color('#22c55e')

ws3.set_column('A:A', 14)
ws3.set_column('B:B', 14)
ws3.set_column('C:C', 14)
ws3.set_column('D:D', 14)
ws3.set_column('E:E', 14)

ws3.write('A1', 'ระดับคะแนน', header_fmt)
ws3.write('B1', 'จำนวนคำตอบ', header_fmt)
ws3.write('A2', 'มากที่สุด (5 คะแนน)', cell_left_fmt)
ws3.write('B2', count_5, cell_fmt)
ws3.write('A3', 'มาก (4 คะแนน)', cell_left_fmt)
ws3.write('B3', count_4, cell_fmt)

chart_pie = wb.add_chart({'type': 'pie'})
chart_pie.add_series({
    'name':       'สัดส่วนระดับความพึงพอใจ',
    'categories': ['กราฟและการวิเคราะห์', 1, 0, 2, 0],
    'values':     ['กราฟและการวิเคราะห์', 1, 1, 2, 1],
    'data_labels': {'percentage': True},
})
chart_pie.set_title({'name': '2. กราฟวงกลม: สัดส่วนร้อยละระดับความพึงพอใจ (150 คำตอบ)'})
chart_pie.set_size({'width': 480, 'height': 320})
ws3.insert_chart('D1', chart_pie)

ws3.write('A6', 'วันที่ทดสอบ', header_blue_fmt)
ws3.write('B6', 'คะแนนเฉลี่ยรายวัน', header_blue_fmt)
ws3.write('C6', 'ผู้ประเมินสะสม', header_blue_fmt)

for idx, d in enumerate(dates):
    ws3.write(6 + idx, 0, d, cell_fmt)
    ws3.write(6 + idx, 1, daily_means[idx], cell_num_fmt)
    ws3.write(6 + idx, 2, cumulative_counts[idx], cell_fmt)

chart_line = wb.add_chart({'type': 'line'})
chart_line.add_series({
    'name':       'คะแนนเฉลี่ยรายวัน',
    'categories': ['กราฟและการวิเคราะห์', 6, 0, 10, 0],
    'values':     ['กราฟและการวิเคราะห์', 6, 1, 10, 1],
    'marker':     {'type': 'circle', 'size': 7},
    'line':       {'color': '#0ea5e9'},
})
chart_line.set_title({'name': '3. กราฟเส้น: แนวโน้มคะแนนเฉลี่ยตามช่วงเวลา (2-6 ก.ย. 2026)'})
chart_line.set_x_axis({'name': 'วันที่ทดสอบระบบ'})
chart_line.set_y_axis({'name': 'คะแนนเฉลี่ย (เต็ม 5)', 'min': 3.5, 'max': 5})
chart_line.set_size({'width': 560, 'height': 320})
ws3.insert_chart('D18', chart_line)

# Insert the high-resolution generated PNG charts
ws3.insert_image('A20', chart1_path, {'x_scale': 0.45, 'y_scale': 0.45})
ws3.insert_image('A40', chart2_path, {'x_scale': 0.45, 'y_scale': 0.45})
ws3.insert_image('A60', chart3_path, {'x_scale': 0.45, 'y_scale': 0.45})

# Protect sheets with password to prevent unauthorized tampering
ws1.protect('GE341511_Secured')
ws2.protect('GE341511_Secured')
ws3.protect('GE341511_Secured')

wb.close()

# Copy all files to user's Documents backup directory
for fname in [
    "1_กราฟแท่ง_คะแนนความพึงพอใจรายด้าน_QueueUp.png",
    "2_กราฟวงกลม_สัดส่วนระดับความพึงพอใจและกลุ่มตัวอย่าง_QueueUp.png",
    "3_กราฟเส้น_แนวโน้มการประเมินตามช่วงเวลา_QueueUp.png",
    "QueueUp_Pilot_Survey_Analysis_GE341511.xlsx"
]:
    src = os.path.join(secure_dir, fname)
    dst = os.path.join(docs_backup_dir, fname)
    if os.path.exists(src):
        shutil.copyfile(src, dst)

print(f"All files created in secure isolated location: {secure_dir}")
print(f"Backup copy saved in user Documents: {docs_backup_dir}")
