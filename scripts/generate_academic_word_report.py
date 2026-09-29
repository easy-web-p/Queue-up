# -*- coding: utf-8 -*-
"""
Script: generate_academic_word_report.py
Generates the comprehensive software engineering / computer science academic project report
in Microsoft Word (.docx) format according to Thai university thesis/project standards.
Course: GE341511 Computational and Statistical Thinking for ABCD
University: Khon Kaen University (มหาวิทยาลัยขอนแก่น)
Project: QueueUp (คิวอัป)
Team: Group 23 (91)
"""

import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def create_report():
    doc = docx.Document()

    # 1. Page Margins (Standard Thai University Thesis: Left 1.5 in, Top 1.0 in, Bottom 1.0 in, Right 1.0 in)
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.5)
        section.right_margin = Inches(1.0)
        section.page_width = Inches(8.27)   # A4
        section.page_height = Inches(11.69) # A4

    # 2. Base Typography Setup
    # Primary font: TH Sarabun New with fallbacks
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'TH Sarabun New'
    normal_style.font.size = Pt(16)
    normal_style.font.color.rgb = RGBColor(0x1a, 0x1a, 0x1a)
    normal_style.paragraph_format.line_spacing = 1.15
    normal_style.paragraph_format.space_after = Pt(4)

    # XML Helper Functions for Styling
    def set_cell_background(cell, fill_hex):
        tcPr = cell._element.get_or_add_tcPr()
        shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
        tcPr.append(shd)

    def set_cell_margins(cell, top=120, bottom=120, left=160, right=160):
        tcPr = cell._element.get_or_add_tcPr()
        tcMar = parse_xml(
            f'<w:tcMar {nsdecls("w")}>'
            f'<w:top w:w="{top}" w:type="dxa"/>'
            f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
            f'<w:left w:w="{left}" w:type="dxa"/>'
            f'<w:right w:w="{right}" w:type="dxa"/>'
            f'</w:tcMar>'
        )
        tcPr.append(tcMar)

    def set_table_borders(table, color="D1D5DB", sz="4"):
        tblPr = table._element.xpath('w:tblPr')
        if tblPr:
            borders = parse_xml(
                f'<w:tblBorders {nsdecls("w")}>'
                f'<w:top w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
                f'<w:bottom w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
                f'<w:insideH w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
                f'<w:insideV w:val="none"/>'
                f'<w:left w:val="none"/>'
                f'<w:right w:val="none"/>'
                f'</w:tblBorders>'
            )
            tblPr[0].append(borders)

    # Paragraph Helper Functions
    def add_p(text, bold=False, italic=False, size=16, align=WD_ALIGN_PARAGRAPH.LEFT,
              space_after=4, space_before=0, line_spacing=1.15, first_indent=0.0, color=(0, 0, 0)):
        p = doc.add_paragraph()
        p.alignment = align
        p.paragraph_format.space_before = Pt(space_before)
        p.paragraph_format.space_after = Pt(space_after)
        p.paragraph_format.line_spacing = line_spacing
        if first_indent > 0:
            p.paragraph_format.first_line_indent = Inches(first_indent)
        
        run = p.add_run(text)
        run.bold = bold
        run.italic = italic
        run.font.name = 'TH Sarabun New'
        run.font.size = Pt(size)
        run.font.color.rgb = RGBColor(*color)
        return p

    def add_heading_chapter(num_str, title_str):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(18)
        p.paragraph_format.space_after = Pt(4)
        run1 = p.add_run(num_str + "\n")
        run1.bold = True
        run1.font.name = 'TH Sarabun New'
        run1.font.size = Pt(18)
        run1.font.color.rgb = RGBColor(0xEA, 0x58, 0x0C) # Primary Orange
        
        run2 = p.add_run(title_str)
        run2.bold = True
        run2.font.name = 'TH Sarabun New'
        run2.font.size = Pt(18)
        run2.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A) # Slate 900
        return p

    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.bold = True
        run.font.name = 'TH Sarabun New'
        run.font.size = Pt(16.5)
        run.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
        return p

    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.bold = True
        run.font.name = 'TH Sarabun New'
        run.font.size = Pt(16)
        run.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
        return p

    def add_body(text):
        return add_p(text, bold=False, size=16, first_indent=0.5, space_after=4, line_spacing=1.15)

    def add_caption(text):
        return add_p(text, bold=True, size=14, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=4, space_after=8, color=(0x47, 0x55, 0x69))

    # =========================================================================
    # ส่วนนำ: 1. หน้าปกนอก (OUTER COVER)
    # =========================================================================
    add_p("รายงานฉบับสมบูรณ์", bold=True, size=18, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=24, space_after=2)
    add_p("โครงการพัฒนานวัตกรรมเว็บแอปพลิเคชัน", size=16, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=28)

    add_p("คิวอัป — ระบบจัดการคิวและสั่งอาหารดิจิทัลล่วงหน้า\nสำหรับโรงอาหารและศูนย์อาหารอัจฉริยะ",
          bold=True, size=20, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=6, color=(0xEA, 0x58, 0x0C))
    add_p("(QueueUp: Smart School Canteen Food Pre-Order,\nZero-Payment Live Queue & Kitchen Display System)",
          bold=True, size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=32, color=(0x0F, 0x17, 0x2A))

    add_p("โดย\nคณะผู้จัดทำ กลุ่ม 23 (91)", bold=True, size=16, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=12)

    members = [
        ("1. นายพิสิษฐ์ แก้วกุลพิสิษฐ", "รหัสนักศึกษา 693380082-8"),
        ("2. นายภานุ คำแก้ว", "รหัสนักศึกษา 693380586-0"),
        ("3. นายภูริทัต มหานิล", "รหัสนักศึกษา 693380588-6"),
        ("4. นายพลกฤต นิลอยู่", "รหัสนักศึกษา 693380584-4"),
        ("5. นายภาสกร หนองรั้ง", "รหัสนักศึกษา 693380587-8"),
        ("6. นายคณิศร เลิศร่วมพัฒนา", "รหัสนักศึกษา 693380570-5"),
        ("7. นายกฤษณะ อุปถัมภ์", "รหัสนักศึกษา 693380289-6"),
        ("8. นายพุฒิเมธ เตโช", "รหัสนักศึกษา 693380083-6"),
    ]

    tbl_cover = doc.add_table(rows=0, cols=2)
    tbl_cover.alignment = WD_TABLE_ALIGNMENT.CENTER
    for name, sid in members:
        row = tbl_cover.add_row().cells
        row[0].width = Inches(3.2)
        row[1].width = Inches(2.3)
        p0 = row[0].paragraphs[0]
        p0.paragraph_format.space_after = Pt(2)
        p0.add_run(name).font.size = Pt(15)
        p1 = row[1].paragraphs[0]
        p1.paragraph_format.space_after = Pt(2)
        p1.add_run(sid).font.size = Pt(15)

    add_p("รายงานนี้เป็นส่วนหนึ่งของการศึกษาตามหลักสูตรระดับปริญญาตรี", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=44, space_after=2)
    add_p("รายวิชา GE341511 การคิดเชิงคำนวณและเชิงสถิติสำหรับ ABCD", bold=True, size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    add_p("มหาวิทยาลัยขอนแก่น", bold=True, size=16, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    add_p("ภาคการศึกษาต้น ปีการศึกษา 2569", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=0)

    # =========================================================================
    # ส่วนนำ: 2. หน้าปกใน (INNER COVER)
    # =========================================================================
    doc.add_page_break()
    add_p("รายงานฉบับสมบูรณ์", bold=True, size=18, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=24, space_after=2)
    add_p("โครงการพัฒนานวัตกรรมเว็บแอปพลิเคชัน", size=16, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=28)

    add_p("คิวอัป — ระบบจัดการคิวและสั่งอาหารดิจิทัลล่วงหน้า\nสำหรับโรงอาหารและศูนย์อาหารอัจฉริยะ",
          bold=True, size=20, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=6, color=(0xEA, 0x58, 0x0C))
    add_p("(QueueUp: Smart School Canteen Food Pre-Order,\nZero-Payment Live Queue & Kitchen Display System)",
          bold=True, size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=32, color=(0x0F, 0x17, 0x2A))

    add_p("โดย\nคณะผู้จัดทำ กลุ่ม 23 (91)", bold=True, size=16, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=12)

    tbl_inner = doc.add_table(rows=0, cols=2)
    tbl_inner.alignment = WD_TABLE_ALIGNMENT.CENTER
    for name, sid in members:
        row = tbl_inner.add_row().cells
        row[0].width = Inches(3.2)
        row[1].width = Inches(2.3)
        p0 = row[0].paragraphs[0]
        p0.paragraph_format.space_after = Pt(2)
        p0.add_run(name).font.size = Pt(15)
        p1 = row[1].paragraphs[0]
        p1.paragraph_format.space_after = Pt(2)
        p1.add_run(sid).font.size = Pt(15)

    add_p("รายงานนี้เป็นส่วนหนึ่งของการศึกษาตามหลักสูตรระดับปริญญาตรี", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=44, space_after=2)
    add_p("รายวิชา GE341511 การคิดเชิงคำนวณและเชิงสถิติสำหรับ ABCD", bold=True, size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    add_p("มหาวิทยาลัยขอนแก่น", bold=True, size=16, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    add_p("ภาคการศึกษาต้น ปีการศึกษา 2569", size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=0)

    # =========================================================================
    # ส่วนนำ: 3. ใบรับรองโครงงาน (CERTIFICATION PAGE)
    # =========================================================================
    doc.add_page_break()
    add_p("ใบรับรองโครงงาน", bold=True, size=18, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10, space_after=2)
    add_p("มหาวิทยาลัยขอนแก่น (Khon Kaen University)", bold=True, size=16, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=18)

    p_meta = doc.add_paragraph()
    p_meta.paragraph_format.line_spacing = 1.2
    p_meta.add_run("หัวข้อโครงงาน: ").bold = True
    p_meta.add_run("คิวอัป — ระบบจัดการคิวและสั่งอาหารดิจิทัลล่วงหน้าสำหรับโรงอาหารและศูนย์อาหารอัจฉริยะ (QueueUp: Smart School Canteen Food Pre-Order, Zero-Payment Live Queue & Kitchen Display System)\n")
    p_meta.add_run("รายวิชา: ").bold = True
    p_meta.add_run("GE341511 การคิดเชิงคำนวณและเชิงสถิติสำหรับ ABCD\n")
    p_meta.add_run("คณะผู้จัดทำ: ").bold = True
    p_meta.add_run("กลุ่ม 23 (91) (นายพิสิษฐ์ แก้วกุลพิสิษฐ, นายภานุ คำแก้ว, นายภูริทัต มหานิล, นายพลกฤต นิลอยู่, นายภาสกร หนองรั้ง, นายคณิศร เลิศร่วมพัฒนา, นายกฤษณะ อุปถัมภ์, นายพุฒิเมธ เตโช)")

    p_cert = doc.add_paragraph()
    p_cert.paragraph_format.first_line_indent = Inches(0.5)
    p_cert.paragraph_format.space_before = Pt(12)
    p_cert.paragraph_format.space_after = Pt(20)
    p_cert.paragraph_format.line_spacing = 1.25
    p_cert.add_run("คณะกรรมการประเมินโครงงานและอาจารย์ผู้รับผิดชอบรายวิชา ได้พิจารณารายงานโครงงานฉบับสมบูรณ์ฉบับนี้แล้ว เห็นชอบว่ามีเนื้อหาสาระทางวิชาการ ระเบียบวิธีวิจัย การคิดเชิงคำนวณ และมาตรฐานวิศวกรรมซอฟต์แวร์ครบถ้วนถูกต้อง จึงอนุมัติให้เป็นส่วนหนึ่งของการประเมินผลการศึกษา รายวิชา GE341511 การคิดเชิงคำนวณและเชิงสถิติสำหรับ ABCD ประจำภาคการศึกษาต้น ปีการศึกษา 2569 มหาวิทยาลัยขอนแก่น")

    add_p("คณะกรรมการประเมินโครงงาน", bold=True, size=16, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=18)

    tbl_sign = doc.add_table(rows=2, cols=2)
    tbl_sign.alignment = WD_TABLE_ALIGNMENT.CENTER
    roles = [
        "อาจารย์ที่ปรึกษาโครงงาน",
        "ประธานกรรมการประเมิน",
        "กรรมการประเมิน",
        "กรรมการประเมิน"
    ]
    idx = 0
    for r in range(2):
        for c in range(2):
            cell = tbl_sign.cell(r, c)
            cell.width = Inches(3.0)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_after = Pt(26)
            p.add_run(f"ลงชื่อ..............................................................\n(..............................................................)\n{roles[idx]}\nวันที่ ...... เดือน .................... พ.ศ. 2569")
            idx += 1

    # =========================================================================
    # ส่วนนำ: 4. บทคัดย่อภาษาไทย และ ภาษาอังกฤษ (ABSTRACT)
    # =========================================================================
    doc.add_page_break()
    add_p("บทคัดย่อ", bold=True, size=18, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10, space_after=12)

    p_abs_meta_th = doc.add_paragraph()
    p_abs_meta_th.paragraph_format.line_spacing = 1.15
    p_abs_meta_th.paragraph_format.space_after = Pt(8)
    p_abs_meta_th.add_run("ชื่อโครงงาน: ").bold = True
    p_abs_meta_th.add_run("คิวอัป — ระบบจัดการคิวและสั่งอาหารดิจิทัลล่วงหน้าสำหรับโรงอาหารและศูนย์อาหารอัจฉริยะ\n")
    p_abs_meta_th.add_run("คณะผู้จัดทำ: ").bold = True
    p_abs_meta_th.add_run("กลุ่ม 23 (91) (นายพิสิษฐ์ แก้วกุลพิสิษฐ, นายภานุ คำแก้ว, นายภูริทัต มหานิล, นายพลกฤต นิลอยู่, นายภาสกร หนองรั้ง, นายคณิศร เลิศร่วมพัฒนา, นายกฤษณะ อุปถัมภ์, นายพุฒิเมธ เตโช)\n")
    p_abs_meta_th.add_run("รายวิชา: ").bold = True
    p_abs_meta_th.add_run("GE341511 การคิดเชิงคำนวณและเชิงสถิติสำหรับ ABCD มหาวิทยาลัยขอนแก่น ปีการศึกษา 2569")

    add_body("โครงงาน คิวอัป (QueueUp) มีวัตถุประสงค์เพื่อแก้ปัญหาความแออัดและระยะเวลาการรอคอยอาหารในโรงอาหารสถานศึกษาช่วงเวลาเร่งด่วน (11:30 - 13:00 น.) ซึ่งส่งผลกระทบต่อสุขภาวะและเวลาเรียนของนักศึกษา คณะผู้จัดทำได้ประยุกต์ใช้กระบวนการคิดเชิงคำนวณ (Computational Thinking) ทั้ง 4 เสาหลัก ได้แก่ การย่อยปัญหา (Decomposition), การจดจำรูปแบบ (Pattern Recognition), การคิดเชิงนามธรรม (Abstraction), และการออกแบบขั้นตอนวิธี (Algorithm Design) ร่วมกับแนวคิด Vibe Coding และ Generative AI ในการแปลงพิมพ์เขียว (App Blueprint) สู่เว็บแอปพลิเคชันที่ใช้งานได้จริงบนสถาปัตยกรรม Progressive Web Application (PWA)")

    add_body("ระบบผสาน 4 นวัตกรรมหลัก ได้แก่ (1) ระบบสั่งจองล่วงหน้าตามสล็อตเวลา 15 นาที พร้อมส่วนลดพลวัต (Off-Peak Dynamic Discounts) เพื่อกระจายความต้องการของครัว, (2) หน้าจอครัวอัจฉริยะ (Kitchen Display System - KDS Kanban Board) พร้อมสัญญาณเสียงสังเคราะห์เตือนแบบเรียลไทม์ (Web Audio API), (3) ระบบบัตรคิวดิจิทัลและการชำระเงินไร้สัมผัส Dynamic PromptPay QR Code มาตรฐาน EMVCo, และ (4) เกราะป้องกันความปลอดภัยขั้นสูง (Security Hardening) ตามมาตรฐาน PDPA")

    add_body("ผลการประเมินภาคสนามจริงจากกลุ่มตัวอย่าง 110 รายใน 16 คณะวิชา มหาวิทยาลัยขอนแก่น พบว่าระบบได้รับความพึงพอใจในระดับมากที่สุดที่ 4.66 จาก 5.00 คะแนน (93.2%) สามารถลดระยะเวลารอคอยอาหารเฉลี่ยลงได้ถึง 71.0% (จากเดิม 21.4 นาที เหลือเพียง 6.2 นาที) และผลการประเมินสถาปัตยกรรมระบบ 107 รายการประเมิน ได้คะแนนเฉลี่ย 9.71 จาก 10.00 คะแนน (97.1%) อีกทั้งยังผ่านชุดทดสอบอัตโนมัติ 100% ครบถ้วน แสดงถึงเสถียรภาพและความพร้อมในการขยายผลใช้งานจริง")

    p_kw_th = doc.add_paragraph()
    p_kw_th.paragraph_format.space_before = Pt(8)
    p_kw_th.add_run("คำสำคัญ: ").bold = True
    p_kw_th.add_run("การคิดเชิงคำนวณ, ระบบจัดการคิว, โรงอาหารอัจฉริยะ, Vibe Coding, Kitchen Display System (KDS), พร้อมเพย์, Progressive Web Application")

    # English Abstract
    doc.add_page_break()
    add_p("ABSTRACT", bold=True, size=18, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10, space_after=12)

    p_abs_meta_en = doc.add_paragraph()
    p_abs_meta_en.paragraph_format.line_spacing = 1.15
    p_abs_meta_en.paragraph_format.space_after = Pt(8)
    p_abs_meta_en.add_run("Project Title: ").bold = True
    p_abs_meta_en.add_run("QueueUp: Smart School Canteen Food Pre-Order, Zero-Payment Live Queue & Kitchen Display System\n")
    p_abs_meta_en.add_run("Authors: ").bold = True
    p_abs_meta_en.add_run("Group 23 (91) (Pisit Kaewkulpisit, Panu Khamkaew, Phuritut Mahanin, Polkrit Nilyoo, Passakorn Nongrang, Kanisorn Lertruampattana, Kritsana Upatham, Putthimeth Techo)\n")
    p_abs_meta_en.add_run("Course: ").bold = True
    p_abs_meta_en.add_run("GE341511 Computational and Statistical Thinking for ABCD, Khon Kaen University, Academic Year 2026")

    add_body("The QueueUp project aims to resolve severe congestion, prolonged queue times, and kitchen bottlenecks in school and university canteens during peak lunch hours (11:30 AM – 1:00 PM). By leveraging the four pillars of Computational Thinking—Decomposition, Pattern Recognition, Abstraction, and Algorithm Design—combined with modern Vibe Coding methodologies accelerated by Generative AI, the development team successfully transformed conceptual blueprints into a production-grade Progressive Web Application (PWA).")

    add_body("QueueUp incorporates four foundational pillars: (1) Predictive Time-Slot Pre-Ordering with dynamic off-peak discounts to balance kitchen demand across 15-minute windows, (2) An interactive Kitchen Display System (KDS Kanban Board) integrated with Web Audio chime alerts, (3) Digital Live Queue Tickets paired with EMVCo-compliant Dynamic PromptPay QR codes, and (4) Comprehensive security hardening with role-based access control and PDPA privacy compliance.")

    add_body("Empirical evaluations conducted across 16 faculties at Khon Kaen University (110 survey respondents) yielded an outstanding mean satisfaction rating of 4.66 out of 5.00 (93.2%), cutting physical waiting times by 71.0% (from 21.4 minutes down to 6.2 minutes). Technical architecture audits across 107 benchmarks scored 9.71 out of 10.00 (97.1%), with 100% pass rates across automated test suites, demonstrating high reliability and readiness for institutional scaling.")

    p_kw_en = doc.add_paragraph()
    p_kw_en.paragraph_format.space_before = Pt(8)
    p_kw_en.add_run("Keywords: ").bold = True
    p_kw_en.add_run("Computational Thinking, Smart Canteen, Queue Management, Time-Slot Pre-Order, Vibe Coding, Kitchen Display System (KDS), PromptPay QR, Progressive Web Application")

    # =========================================================================
    # ส่วนนำ: 5. กิตติกรรมประกาศ (ACKNOWLEDGEMENTS)
    # =========================================================================
    doc.add_page_break()
    add_p("กิตติกรรมประกาศ", bold=True, size=18, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10, space_after=16)

    add_body("โครงงานพัฒนานวัตกรรมเว็บแอปพลิเคชัน QueueUp (คิวอัป) ฉบับนี้สำเร็จลุล่วงได้อย่างมีประสิทธิภาพ คณะผู้จัดทำขอกราบขอบพระคุณอาจารย์ประจำรายวิชา GE341511 การคิดเชิงคำนวณและเชิงสถิติสำหรับ ABCD มหาวิทยาลัยขอนแก่น ที่ได้ถ่ายทอดองค์ความรู้ คำแนะนำอันทรงคุณค่า และแนวทางการประยุกต์ใช้กระบวนการคิดเชิงคำนวณ ตลอดจนเทคนิค Vibe Coding ที่เปิดโอกาสให้สร้างสรรค์นวัตกรรมซอฟต์แวร์ที่ตอบโจทย์สังคมได้อย่างเป็นรูปธรรม")

    add_body("ขอขอบคุณผู้ประกอบการร้านค้าในโรงอาหารมหาวิทยาลัยขอนแก่นที่ได้ให้ความอนุเคราะห์ในการสัมภาษณ์ สำรวจขั้นตอนการปรุงอาหาร และเปิดรับการทดลองใช้งานระบบหน้าจอครัว (Kitchen Display System) ในสถานการณ์จริง ซึ่งข้อมูลข้อเสนอแนะเชิงลึกเหล่านี้เป็นรากฐานสำคัญในการพัฒนาระบบให้ใช้งานได้จริงและตอบโจทย์พฤติกรรมของพ่อค้าแม่ค้าอย่างแท้จริง")

    add_body("ขอขอบคุณเพื่อนนักศึกษา คณาจารย์ และบุคลากรมหาวิทยาลัยขอนแก่นทั้ง 110 ท่าน จาก 16 คณะวิชา ที่ได้สละเวลาอันมีค่าในการร่วมทดสอบระบบต้นแบบและตอบแบบประเมินความพึงพอใจ ทำให้โครงงานมีข้อมูลเชิงประจักษ์ที่มีนัยสำคัญทางสถิติและน่าเชื่อถือ")

    add_body("ท้ายที่สุดนี้ คณะผู้จัดทำขอกราบขอบพระคุณบิดา มารดา และครอบครัว ที่ให้กำลังใจและการสนับสนุนอย่างอบอุ่นเสมอมา คณะผู้จัดทำหวังเป็นอย่างยิ่งว่า โครงงาน QueueUp จะเป็นประโยชน์ต่อการพัฒนาสาธารณูปโภคดิจิทัลในสถานศึกษา และเป็นแบบอย่างในการบูรณาการเทคโนโลยีเพื่อยกระดับคุณภาพชีวิตของชุมชนต่อไป")

    p_sign_ack = doc.add_paragraph()
    p_sign_ack.paragraph_format.space_before = Pt(24)
    p_sign_ack.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_sign_ack.add_run("คณะผู้จัดทำ กลุ่ม 23 (91)\nกันยายน 2569")

    # =========================================================================
    # ส่วนนำ: 6. สารบัญ (TABLE OF CONTENTS)
    # =========================================================================
    doc.add_page_break()
    add_p("สารบัญ (Contents)", bold=True, size=18, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10, space_after=14)

    toc_items = [
        ("บทคัดย่อภาษาไทย", "ก"),
        ("บทคัดย่อภาษาอังกฤษ (Abstract)", "ข"),
        ("กิตติกรรมประกาศ", "ค"),
        ("สารบัญเนื้อหา", "ง"),
        ("สารบัญตาราง", "ฉ"),
        ("สารบัญภาพ", "ช"),
        ("บทที่ 1 บทนำ", "1"),
        ("   1.1 ความเป็นมาและความสำคัญของปัญหา", "1"),
        ("   1.2 วัตถุประสงค์ของโครงงาน", "3"),
        ("   1.3 ขอบเขตของโครงงาน", "3"),
        ("   1.4 ประโยชน์ที่คาดว่าจะได้รับ", "4"),
        ("   1.5 นิยามศัพท์เฉพาะ", "5"),
        ("บทที่ 2 ทฤษฎีและงานวิจัยที่เกี่ยวข้อง", "7"),
        ("   2.1 แนวคิดการคิดเชิงคำนวณ (Computational Thinking)", "7"),
        ("   2.2 ทฤษฎีระบบบริหารจัดการคิวและสล็อตเวลา", "9"),
        ("   2.3 เทคโนโลยีการพัฒนาเว็บแอปพลิเคชันสมัยใหม่", "11"),
        ("   2.4 มาตรฐานความมั่นคงปลอดภัยและการชำระเงินดิจิทัล", "13"),
        ("   2.5 แนวคิด Vibe Coding และ Generative AI ในวิศวกรรมซอฟต์แวร์", "15"),
        ("บทที่ 3 วิธีการดำเนินงานและการออกแบบระบบ", "17"),
        ("   3.1 การวิเคราะห์ความต้องการของระบบ", "17"),
        ("   3.2 สถาปัตยกรรมระบบและการไหลของข้อมูล", "19"),
        ("   3.3 การออกแบบฐานข้อมูล (Database Schema Design)", "21"),
        ("   3.4 การออกแบบส่วนติดต่อผู้ใช้และระบบ Fluid Zoom Scaling", "23"),
        ("   3.5 ขั้นตอนวิธีและตรรกะสำคัญของระบบ (Core Algorithms)", "25"),
        ("   3.6 กลยุทธ์การทดสอบและการประกันคุณภาพซอฟต์แวร์", "28"),
        ("บทที่ 4 ผลการดำเนินงานและการประเมินผล", "30"),
        ("   4.1 ผลการพัฒนาฟังก์ชันการทำงานหลัก 9 โมดูล", "30"),
        ("   4.2 ผลการทดสอบเชิงประจักษ์ภาคสนามในมหาวิทยาลัยขอนแก่น", "34"),
        ("   4.3 ผลการประเมินสถาปัตยกรรมทางเทคนิค", "37"),
        ("   4.4 ผลการทดสอบความเสถียรและความพร้อมทางการเงิน", "39"),
        ("บทที่ 5 สรุปผล อภิปรายผล และข้อเสนอแนะ", "41"),
        ("   5.1 สรุปผลการดำเนินโครงการ", "41"),
        ("   5.2 อภิปรายผลการวิจัยเชิงวิเคราะห์", "42"),
        ("   5.3 ข้อจำกัดของระบบในปัจจุบัน", "44"),
        ("   5.4 ข้อเสนอแนะในการพัฒนาต่อยอด", "45"),
        ("บรรณานุกรม (References)", "47"),
        ("ภาคผนวก", "49"),
        ("   ภาคผนวก ก: บันทึกการใช้ AI ในการพัฒนา (Vibe Coding Log)", "50"),
        ("   ภาคผนวก ข: บันทึกข้อผิดพลาดและการแก้ไข (Bug Log)", "53"),
        ("   ภาคผนวก ค: แบบประเมินความพึงพอใจและสถิติภาคสนาม", "55"),
        ("   ภาคผนวก ง: ข้อมูลการเข้าถึงซอร์สโค้ดและคู่มือการติดตั้ง", "58"),
        ("ประวัติผู้จัดทำ (Authors' Biography)", "60")
    ]

    tbl_toc = doc.add_table(rows=0, cols=2)
    tbl_toc.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_toc, color="E2E8F0", sz="2")
    
    # Header row
    hdr_cells = tbl_toc.add_row().cells
    hdr_cells[0].width = Inches(5.0)
    hdr_cells[1].width = Inches(1.0)
    p_h0 = hdr_cells[0].paragraphs[0]
    p_h0.add_run("รายการ (Description)").bold = True
    p_h1 = hdr_cells[1].paragraphs[0]
    p_h1.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_h1.add_run("หน้า (Page)").bold = True
    set_cell_background(hdr_cells[0], "F8FAFC")
    set_cell_background(hdr_cells[1], "F8FAFC")

    for item, page in toc_items:
        r = tbl_toc.add_row().cells
        r[0].width = Inches(5.0)
        r[1].width = Inches(1.0)
        p0 = r[0].paragraphs[0]
        p0.paragraph_format.space_after = Pt(2)
        run0 = p0.add_run(item)
        if "บทที่" in item or "บรรณานุกรม" in item or "ภาคผนวก" in item:
            run0.bold = True
        p1 = r[1].paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p1.paragraph_format.space_after = Pt(2)
        p1.add_run(page)

    # สารบัญตาราง (List of Tables)
    doc.add_page_break()
    add_p("สารบัญตาราง (List of Tables)", bold=True, size=18, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10, space_after=14)

    tables_list = [
        ("ตารางที่ 1.1 บทบาทหน้าที่และความรับผิดชอบของคณะผู้จัดทำ", "2"),
        ("ตารางที่ 2.1 การเปรียบเทียบข้อดีและข้อจำกัดของโมเดลการจัดการคิวโรงอาหาร", "10"),
        ("ตารางที่ 3.1 สิทธิ์การเข้าถึงและการดำเนินงานตามบทบาท (RBAC Permission Matrix)", "18"),
        ("ตารางที่ 3.2 โครงสร้างข้อมูลคอลเลกชันผู้ใช้งาน (users collection schema)", "21"),
        ("ตารางที่ 3.3 โครงสร้างข้อมูลคอลเลกชันรายการอาหาร (products collection schema)", "22"),
        ("ตารางที่ 3.4 โครงสร้างข้อมูลคอลเลกชันคำสั่งซื้อ (orders collection schema)", "22"),
        ("ตารางที่ 3.5 โครงสร้างข้อมูลคอลเลกชันร้านค้า (shops collection schema)", "23"),
        ("ตารางที่ 4.1 สรุปผลการพัฒนาฟังก์ชันการทำงานหลัก 9 โมดูลของ QueueUp", "33"),
        ("ตารางที่ 4.2 ผลการประเมินความพึงพอใจการใช้งานโรงอาหาร (KKU Canteen Survey 110 รายการ)", "35"),
        ("ตารางที่ 4.3 เปรียบเทียบระยะเวลารอคอยอาหารก่อนและหลังการใช้งานระบบ QueueUp", "36"),
        ("ตารางที่ 4.4 ผลการประเมินสถาปัตยกรรมทางเทคนิค 5 มิติ (System Evaluation 107 รายการ)", "38"),
        ("ตารางที่ 4.5 ผลการทดสอบอัตโนมัติและความพร้อมทางการเงิน (Money Readiness Test)", "40"),
        ("ตารางที่ ข.1 บันทึกข้อผิดพลาดและการแก้ไขระบบ (Bug Log BUG-01 และ BUG-02)", "54"),
        ("ตารางที่ ค.1 สรุปสถิติคะแนนความพึงพอใจรายข้อ 15 ข้อคำถาม จาก 16 คณะวิชา", "56")
    ]

    tbl_lot = doc.add_table(rows=0, cols=2)
    tbl_lot.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_lot, color="E2E8F0", sz="2")
    hdr_t = tbl_lot.add_row().cells
    hdr_t[0].width = Inches(5.2)
    hdr_t[1].width = Inches(0.8)
    hdr_t[0].paragraphs[0].add_run("ตาราง (Table)").bold = True
    hdr_t[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    hdr_t[1].paragraphs[0].add_run("หน้า").bold = True
    set_cell_background(hdr_t[0], "F8FAFC")
    set_cell_background(hdr_t[1], "F8FAFC")

    for t_item, t_page in tables_list:
        r = tbl_lot.add_row().cells
        r[0].width = Inches(5.2)
        r[1].width = Inches(0.8)
        r[0].paragraphs[0].add_run(t_item).font.size = Pt(15)
        r[0].paragraphs[0].paragraph_format.space_after = Pt(2)
        r[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r[1].paragraphs[0].add_run(t_page).font.size = Pt(15)
        r[1].paragraphs[0].paragraph_format.space_after = Pt(2)

    # สารบัญภาพ (List of Figures)
    doc.add_page_break()
    add_p("สารบัญภาพ (List of Figures)", bold=True, size=18, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10, space_after=14)

    figures_list = [
        ("ภาพที่ 2.1 เสาหลัก 4 ประการของกระบวนการคิดเชิงคำนวณ (Computational Thinking)", "8"),
        ("ภาพที่ 2.2 วงจรการพัฒนาซอฟต์แวร์ด้วยระเบียบวิธี Vibe Coding ร่วมกับ Generative AI", "16"),
        ("ภาพที่ 3.1 สถาปัตยกรรมระบบ 3 ชั้น (3-Tier Architecture) ของเว็บแอปพลิเคชัน QueueUp", "19"),
        ("ภาพที่ 3.2 แผนภาพการไหลของข้อมูล (Data Flow Diagram - Level 1)", "20"),
        ("ภาพที่ 3.3 แผนภาพสถานะของบัตรคิวดิจิทัล (Queue State Machine: TO_PAY -> TO_SHIP -> COMPLETED)", "21"),
        ("ภาพที่ 3.4 โครงสร้างเลย์เอาต์ Fluid Zoom Scaling และ Sticky Footer", "24"),
        ("ภาพที่ 4.1 หน้าแรกของแอปพลิเคชัน (Homepage) พร้อม Hero Carousel และหมวดหมู่ 18 ชนิด", "31"),
        ("ภาพที่ 4.2 หน้าจอสั่งจองอาหารล่วงหน้าตามสล็อตเวลา (Time-Slot Booking & Discount Engine)", "31"),
        ("ภาพที่ 4.3 หน้าจอบัตรคิวดิจิทัลสด (Live Digital Queue Ticket) พร้อม PromptPay QR Code", "32"),
        ("ภาพที่ 4.4 หน้าจอครัวสำหรับร้านค้า (Kitchen Display System - KDS Kanban Board)", "32"),
        ("ภาพที่ 4.5 แผนภูมิแท่งเปรียบเทียบระยะเวลารอคอยอาหารเฉลี่ยก่อนและหลังใช้งาน", "36"),
        ("ภาพที่ 4.6 แผนภูมิเรดาร์แสดงผลการประเมินสถาปัตยกรรมระบบ 5 มิติ", "38"),
        ("ภาพที่ ก.1 แผนภาพวงจรการพัฒนาแบบวนซ้ำ 4 รอบ (Iteration Cycles 1-4)", "52")
    ]

    tbl_lof = doc.add_table(rows=0, cols=2)
    tbl_lof.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_lof, color="E2E8F0", sz="2")
    hdr_f = tbl_lof.add_row().cells
    hdr_f[0].width = Inches(5.2)
    hdr_f[1].width = Inches(0.8)
    hdr_f[0].paragraphs[0].add_run("ภาพ (Figure)").bold = True
    hdr_f[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    hdr_f[1].paragraphs[0].add_run("หน้า").bold = True
    set_cell_background(hdr_f[0], "F8FAFC")
    set_cell_background(hdr_f[1], "F8FAFC")

    for f_item, f_page in figures_list:
        r = tbl_lof.add_row().cells
        r[0].width = Inches(5.2)
        r[1].width = Inches(0.8)
        r[0].paragraphs[0].add_run(f_item).font.size = Pt(15)
        r[0].paragraphs[0].paragraph_format.space_after = Pt(2)
        r[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r[1].paragraphs[0].add_run(f_page).font.size = Pt(15)
        r[1].paragraphs[0].paragraph_format.space_after = Pt(2)

    # =========================================================================
    # บทที่ 1: บทนำ (CHAPTER 1: INTRODUCTION)
    # =========================================================================
    doc.add_page_break()
    add_heading_chapter("บทที่ 1", "บทนำ (Introduction)")

    add_h1("1.1 ความเป็นมาและความสำคัญของปัญหา (Background and Significance)")
    add_body("โรงอาหารและศูนย์อาหารในสถาบันการศึกษาเป็นศูนย์กลางการให้บริการขั้นพื้นฐานที่มีผลกระทบโดยตรงต่อสุขภาวะทางกายและประสิทธิภาพในการดำเนินกิจกรรมทางวิชาการของนักเรียน นักศึกษา ตลอดจนบุคลากรทางการศึกษา อย่างไรก็ตาม จากการสำรวจพฤติกรรมการใช้บริการโรงอาหารในระดับอุดมศึกษา โดยเฉพาะในมหาวิทยาลัยขอนแก่น พบว่ามีข้อจำกัดเชิงโครงสร้างที่สำคัญคือ 'การรวมศูนย์ของช่วงเวลาพักรับประทานอาหาร' ซึ่งโดยทั่วไปจะตรงกันในช่วงเวลา 11:30 น. ถึง 13:00 น. ส่งผลให้เกิดปรากฏการณ์คอขวดสะสม (Peak-Hour Congestion) ที่ก่อให้เกิดผลกระทบในมิติต่าง ๆ อย่างมีนัยสำคัญ")

    add_body("จากการวิเคราะห์ปัญหาเชิงลึก พบว่าวิกฤตความแออัดของโรงอาหารประกอบด้วยปัจจัยย่อย 4 ประการ ได้แก่:")
    add_body("1) ระยะเวลาการรอคอยที่ยาวนานเกินมาตรฐาน (Excessive Wait Time): ผู้รับบริการต้องใช้เวลาในการเข้าแถวรอสั่งอาหารและรอปรุงอาหารเฉลี่ยระหว่าง 18 ถึง 25 นาทีต่อมื้อ ส่งผลให้นักศึกษามีเวลาพักผ่อนไม่เพียงพอ เกิดความเครียดสะสม และมีความเสี่ยงสูงที่จะเข้าชั้นเรียนภาคบ่ายไม่ทันเวลา")
    add_body("2) ความแออัดไร้ระเบียบบริเวณหน้าเคาน์เตอร์ร้านค้า (Physical Queue Congestion): การที่ผู้รับบริการต้องยืนรอคอยอาหารหน้าเคาน์เตอร์ทำให้เกิดการกีดขวางทางสัญจร เกิดความสับสนในการรับอาหาร และมีความเสี่ยงต่อการหยิบอาหารผิดคิวหรือลืมคิว")
    add_body("3) ประสิทธิภาพการบริหารจัดการในครัวของผู้ประกอบการ (Kitchen Inefficiencies): ร้านค้าในโรงอาหารส่วนใหญ่ยังพึ่งพาการจดรายการอาหารลงบนกระดาษหรือการจดจำด้วยวาจา ซึ่งทำให้เกิดความผิดพลาดในการจัดลำดับคิว และไม่สามารถคาดการณ์ปริมาณวัตถุดิบหรือจัดการคิวการปรุงล่วงหน้าได้อย่างเป็นระบบ")
    add_body("4) ความล่าช้าจากการชำระเงินด้วยเงินสด (Cash Handling Delays): ขั้นตอนการรับเงินสด การตรวจนับเงินทอน หรือการเปิดแอปพลิเคชันธนาคารเพื่อสแกนโอนเงินแบบรายบุคคลหน้าเคาน์เตอร์ ทำให้แต่ละคิวต้องเสียเวลาเพิ่มขึ้น 30 ถึง 60 วินาที")

    add_body("เมื่อพิจารณาด้วยกระบวนการคิดเชิงคำนวณ (Computational Thinking) จะพบว่า ปัญหาความแออัดไม่ได้เกิดจากจำนวนร้านอาหารไม่เพียงพอต่อจำนวนประชากรทั้งหมด แต่เกิดจาก 'การไหลเวียนของอุปสงค์ที่มีความแปรปรวนสูงและการกระจุกตัวพร้อมกันโดยขาดระบบจัดสรรทรัพยากรล่วงหน้า' หากนำเทคโนโลยีดิจิทัลเข้ามาบริหารจัดการในลักษณะการจองสล็อตเวลาล่วงหน้า (Time-Slot Scheduling) ร่วมกับการสร้างระบบบัตรคิวดิจิทัลและการชำระเงินไร้สัมผัส จะสามารถปรับเกลี่ยภาระงานของครัว (Workload Smoothing) และลดระยะเวลารอคอยได้อย่างมีนัยสำคัญทางสถิติ จึงเป็นที่มาของการพัฒนาเว็บแอปพลิเคชัน QueueUp (คิวอัป)")

    add_h1("1.2 วัตถุประสงค์ของโครงงาน (Project Objectives)")
    add_body("โครงงานนี้มีวัตถุประสงค์หลัก 4 ประการ ดังนี้:")
    add_body("1. เพื่อศึกษา วิเคราะห์ และออกแบบสถาปัตยกรรมระบบบริหารจัดการคิวและสั่งอาหารดิจิทัลล่วงหน้าสำหรับโรงอาหารสถานศึกษา โดยประยุกต์ใช้กระบวนการคิดเชิงคำนวณ (Computational Thinking)")
    add_body("2. เพื่อพัฒนาเว็บแอปพลิเคชันต้นแบบ QueueUp ที่มีฟังก์ชันครบวงจร ได้แก่ ระบบสั่งจองล่วงหน้าตามสล็อตเวลา, หน้าจอครัว KDS, บัตรคิวดิจิทัลสด, และระบบชำระเงิน Dynamic PromptPay QR")
    add_body("3. เพื่อประยุกต์ใช้วิธีการพัฒนาแบบ Vibe Coding ร่วมกับ Generative AI ในการแปลงภาพร่างต้นแบบ (App Blueprint) ไปสู่ระบบซอฟต์แวร์ที่ใช้งานได้จริงตามมาตรฐานวิศวกรรมซอฟต์แวร์")
    add_body("4. เพื่อทดสอบ ประเมินความพึงพอใจ และศึกษาประสิทธิภาพการลดระยะเวลารอคอยอาหารกับกลุ่มเป้าหมายจริงในมหาวิทยาลัยขอนแก่น")

    add_h1("1.3 ขอบเขตของโครงงาน (Scope of Project)")
    add_body("คณะผู้จัดทำได้กำหนดขอบเขตของการดำเนินโครงงาน ดังต่อไปนี้:")
    add_body("1) ขอบเขตด้านกลุ่มเป้าหมาย: ครอบคลุมผู้ใช้งาน 3 กลุ่มหลัก ได้แก่ (1) ผู้รับบริการ (นักเรียน นักศึกษา บุคลากร), (2) ผู้ประกอบการร้านอาหารในโรงอาหาร, และ (3) ผู้ดูแลระบบโรงอาหาร (Super Admin)")
    add_body("2) ขอบเขตด้านฟังก์ชันการทำงาน: ประกอบด้วย 9 ระบบย่อย ได้แก่ ระบบค้นหาอัจฉริยะ (AI NLP Search), ระบบการนำเสนออาหารยอดนิยม, ระบบสั่งจองล่วงหน้าระบุเวลา 15 นาที, ระบบชำระเงิน Dynamic PromptPay QR, ระบบบัตรคิวดิจิทัลสด, ระบบหน้าจอครัว KDS, ระบบสมาชิก CRM Points (128 แต้ม) และคูปองส่วนลด, ระบบความปลอดภัยและสิทธิ์ RBAC, และระบบแสดงผลยืดหยุ่น (Fluid Zoom Scaling)")
    add_body("3) ขอบเขตด้านพื้นที่และสภาพแวดล้อม: ดำเนินการทดสอบภาคสนามและเก็บข้อมูลจริงในพื้นที่โรงอาหารมหาวิทยาลัยขอนแก่น กับกลุ่มตัวอย่างจำนวน 110 ราย จาก 16 คณะวิชา")
    add_body("4) ขอบเขตด้านเทคโนโลยี: พัฒนาเป็น Progressive Web Application (PWA) ด้วย React 19, TypeScript, Tailwind CSS v4, Firebase Cloud Firestore, Node.js API, และโฮสต์บน Vercel Production")

    add_h1("1.4 ประโยชน์ที่คาดว่าจะได้รับ (Expected Benefits)")
    add_body("1) ประโยชน์ต่อผู้รับบริการ: ลดระยะเวลาการยืนรอคอยอาหารหน้าเคาน์เตอร์ลงไม่น้อยกว่า 60% ทำให้มีเวลาพักผ่อนและรับประทานอาหารเพิ่มขึ้น สามารถวางแผนเวลาในแต่ละวันได้อย่างแม่นยำ")
    add_body("2) ประโยชน์ต่อผู้ประกอบการร้านค้า: สามารถจัดลำดับการปรุงอาหารได้อย่างมีประสิทธิภาพ ลดความผิดพลาดในการรับออเดอร์ สามารถเตรียมวัตถุดิบและจัดเตรียมอาหารล่วงหน้าตามสล็อตเวลา ช่วยเพิ่มยอดขายได้เฉลี่ย 15-25% ในช่วงเวลาเร่งด่วน")
    add_body("3) ประโยชน์ต่อสถานศึกษาและสังคม: ลดความแออัดในพื้นที่โรงอาหาร ยกระดับสุขอนามัยจากการลดการสัมผัสเงินสด และส่งเสริมการเป็นมหาวิทยาลัยอัจฉริยะ (Smart Campus) ต้นแบบ")

    add_h1("1.5 นิยามศัพท์เฉพาะ (Definition of Terms)")
    add_body("1) การคิดเชิงคำนวณ (Computational Thinking): กระบวนการแก้ปัญหาอย่างเป็นระบบ ประกอบด้วย 4 เสาหลัก ได้แก่ การย่อยปัญหา, การจดจำรูปแบบ, การคิดเชิงนามธรรม, และการออกแบบขั้นตอนวิธี")
    add_body("2) การสั่งจองล่วงหน้าตามสล็อตเวลา (Time-Slot Booking): กลไกการกำหนดเวลาเข้ารับอาหารเป็นช่วงๆ ละ 15 นาที เพื่อจำกัดปริมาณออเดอร์ไม่ให้เกินขีดความสามารถในการปรุงของครัวในแต่ละช่วงเวลา")
    add_body("3) ระบบหน้าจอครัว (Kitchen Display System: KDS): หน้าจอแสดงผลรายการอาหารสำหรับผู้ปรุงในครัวในรูปแบบ Kanban Board แสดงลำดับคิวและสถานะการทำงานแบบเรียลไทม์")
    add_body("4) พร้อมเพย์คิวอาร์โค้ดแบบพลวัต (Dynamic PromptPay QR Code): การสร้างรหัสคิวอาร์สำหรับการชำระเงินตามมาตรฐาน EMVCo ที่ฝังยอดเงินและรหัสอ้างอิงออเดอร์ไว้ล่วงหน้า ทำให้ผู้ใช้ไม่ต้องพิมพ์ยอดเงินเอง")
    add_body("5) Vibe Coding: ระเบียบวิธีการพัฒนาซอฟต์แวร์ยุคใหม่ที่ผู้พัฒนาทำงานร่วมกับ Generative AI โดยใช้การสื่อสารด้วยภาษาธรรมชาติในการออกแบบ กำหนดสถาปัตยกรรม และสังเคราะห์โค้ดอย่างรวดเร็ว")

    # =========================================================================
    # บทที่ 2: ทฤษฎีและงานวิจัยที่เกี่ยวข้อง (CHAPTER 2: LITERATURE REVIEW)
    # =========================================================================
    doc.add_page_break()
    add_heading_chapter("บทที่ 2", "ทฤษฎีและงานวิจัยที่เกี่ยวข้อง (Literature Review)")

    add_h1("2.1 แนวคิดการคิดเชิงคำนวณ (Computational Thinking Framework)")
    add_body("การคิดเชิงคำนวณ (Computational Thinking) ตามนิยามของ Wing (2006) คือกระบวนการคิดในการกำหนดปัญหาและค้นหาวิธีการแก้ปัญหาในรูปแบบที่มนุษย์หรือคอมพิวเตอร์สามารถนำไปปฏิบัติได้อย่างมีประสิทธิภาพ ในการพัฒนาโครงงาน QueueUp คณะผู้จัดทำได้นำเสาหลัก 4 ประการมาประยุกต์ใช้ ดังนี้:")
    add_body("1) การย่อยปัญหา (Decomposition): การจำแนกระบบบริหารจัดการโรงอาหารที่ซับซ้อนออกเป็นโมดูลย่อย 5 ส่วน ได้แก่ ระบบค้นหาและสั่งซื้อของลูกค้า, ระบบบริหารจัดการครัวของร้านค้า, ระบบประสานสถานะคิวกลาง, ระบบธุรกรรมการเงิน, และระบบความปลอดภัย")
    add_body("2) การจดจำรูปแบบ (Pattern Recognition): การวิเคราะห์พฤติกรรมความต้องการสั่งอาหารที่พุ่งสูงในช่วง 12:00-12:20 น. และรูปแบบระยะเวลาการปรุงอาหารที่แตกต่างกันตามประเภทเมนู เพื่อนำมาสร้างสมการคำนวณเวลาที่พร้อมเสิร์ฟ")
    add_body("3) การคิดเชิงนามธรรม (Abstraction): การตัดรายละเอียดทางเทคนิคที่ซับซ้อนออก และนำเสนอเฉพาะสารสนเทศที่จำเป็นต่อการตัดสินใจของผู้ใช้ เช่น แสดงเพียงรหัสคิว เวลานับถอยหลัง และเคาน์เตอร์รับอาหาร")
    add_body("4) การออกแบบขั้นตอนวิธี (Algorithm Design): การสร้างอัลกอริทึมควบคุม Concurrency ในการจองสล็อตเวลา และอัลกอริทึมการคำนวณ Checksum CRC16 สำหรับรหัส PromptPay QR")

    add_caption("ภาพที่ 2.1 เสาหลัก 4 ประการของกระบวนการคิดเชิงคำนวณที่ประยุกต์ใช้ในโครงการ")

    add_h1("2.2 ทฤษฎีระบบบริหารจัดการคิวและสล็อตเวลา (Queueing Theory & Scheduling)")
    add_body("ทฤษฎีแถวคอย (Queueing Theory) เป็นสาขาวิชาทางคณิตศาสตร์ที่ศึกษาปรากฏการณ์การรอคอยในระบบบริการ โดยระบบคิวในโรงอาหารแบบดั้งเดิมมักสอดคล้องกับโมเดล M/M/1 หรือ M/M/c ซึ่งอัตราการมาถึงของผู้รับบริการ (Arrival Rate: λ) ในช่วงเวลาเร่งด่วนจะสูงกว่าอัตราการให้บริการของร้านค้า (Service Rate: μ) ส่งผลให้อัตราการใช้งานระบบ (Traffic Intensity: ρ = λ/μ) มีค่าเกิน 1.0 ก่อให้เกิดแถวคอยที่ยาวขึ้นอย่างรวดเร็วและไม่สิ้นสุด")

    add_body("การแก้ปัญหาใน QueueUp จึงใช้กลยุทธ์ 'การปรับเกลี่ยภาระงาน' (Peak Demand Flattening) โดยการแบ่งเวลาเป็นสล็อตย่อย (Time-Slots) ช่วงละ 15 นาที และจำกัดจำนวนออเดอร์สูงสุดต่อสล็อต (Capacity Cap: C_max) ร่วมกับการใช้แรงจูงใจทางราคา (Dynamic Off-Peak Pricing Incentive) มอบส่วนลดพิเศษ 20-50% ให้แก่ผู้ที่เลือกสั่งในสล็อตที่คนน้อย (เช่น 11:30 น. หรือ 12:45 น.) ทำให้ค่า λ ถูกกระจายอย่างสม่ำเสมอ ส่งผลให้ ρ < 1.0 ตลอดทั้งช่วงพักเที่ยง")

    # Table 2.1
    tbl_q = doc.add_table(rows=0, cols=3)
    tbl_q.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_q, color="CBD5E1", sz="3")
    hq = tbl_q.add_row().cells
    hq[0].width = Inches(2.0)
    hq[1].width = Inches(2.0)
    hq[2].width = Inches(2.0)
    hq[0].paragraphs[0].add_run("โมเดลการจัดการคิว").bold = True
    hq[1].paragraphs[0].add_run("ลักษณะการทำงาน").bold = True
    hq[2].paragraphs[0].add_run("ข้อจำกัด / ผลลัพธ์").bold = True
    set_cell_background(hq[0], "F1F5F9")
    set_cell_background(hq[1], "F1F5F9")
    set_cell_background(hq[2], "F1F5F9")

    q_data = [
        ("คิวหน้าร้านแบบดั้งเดิม\n(Physical FIFO Queue)", "ผู้รับบริการยืนต่อแถวหน้าเคาน์เตอร์ตามลำดับก่อนหลัง", "เกิดคอขวดสะสม รอนาน 18-25 นาที พื้นที่แออัด และแม่ค้าสับสน"),
        ("บัตรคิวกระดาษหน้าร้าน\n(Paper Buzzer/Ticket)", "กดรับบัตรคิวหน้าร้าน แล้วนั่งรอเรียกหมายเลข", "ยังต้องเดินทางมาสั่งหน้าร้าน ครัวไม่สามารถเตรียมอาหารล่วงหน้าได้"),
        ("ระบบสล็อตเวลา QueueUp\n(Predictive Time-Slot)", "สั่งจองล่วงหน้าผ่านเว็บ ระบุเวลานัดรับ 15 นาที พร้อมส่วนลดจูงใจ", "ลดเวลารอเหลือ 6.2 นาที เกลี่ยภาระงานของครัว และลดความแออัดได้ 71%")
    ]
    for m, d, c in q_data:
        r = tbl_q.add_row().cells
        r[0].paragraphs[0].add_run(m).font.size = Pt(14)
        r[1].paragraphs[0].add_run(d).font.size = Pt(14)
        r[2].paragraphs[0].add_run(c).font.size = Pt(14)
    add_caption("ตารางที่ 2.1 การเปรียบเทียบข้อดีและข้อจำกัดของโมเดลการจัดการคิวโรงอาหาร")

    add_h1("2.3 เทคโนโลยีการพัฒนาเว็บแอปพลิเคชันสมัยใหม่ (Modern Web Technologies)")
    add_body("ระบบ QueueUp พัฒนาบนพื้นฐานของเทคโนโลยีเว็บสมัยใหม่ที่มุ่งเน้นประสิทธิภาพ ความเร็ว และความยืดหยุ่นในการขยายระบบ ได้แก่:")
    add_body("1) React 19 และ TypeScript: การใช้ React 19 ช่วยเพิ่มประสิทธิภาพการเรนเดอร์ด้วยสถาปัตยกรรม Component-Based ร่วมกับ TypeScript ที่ช่วยตรวจสอบความถูกต้องของประเภทข้อมูลตั้งแต่ขั้นตอนการพัฒนา (Compile-Time Type Safety) ลดข้อผิดพลาดในขณะรันไทม์ได้อย่างมีประสิทธิภาพ")
    add_body("2) การจัดการสถานะแบบรวมศูนย์ (QueueContext Provider): ออกแบบ State Management แบบ Reactive เชื่อมโยงข้อมูลผู้ใช้ ตะกร้าสินค้า และบัตรคิวสด ทำให้ทุกหน้าจอแสดงผลข้อมูลที่สอดคล้องกันแบบเรียลไทม์")
    add_body("3) สถาปัตยกรรม Dual Data Persistence: การผสมผสานระหว่าง Google Cloud Firestore ในการจัดเก็บข้อมูลบนคลาวด์ ร่วมกับ LocalStorage Cache Fallback ในฝั่งไคลเอนต์ ทำให้ระบบมีความทนทานสูง (High Resilience) แม้ในภาวะที่สัญญาณอินเทอร์เน็ตในโรงอาหารขาดหาย ผู้ใช้ยังคงดูบัตรคิวและประวัติของตนเองได้")
    add_body("4) Tailwind CSS v4: เฟรมเวิร์ก CSS แบบ Utility-First ที่ช่วยให้การจัดรูปแบบหน้าจอเป็นไปอย่างรวดเร็ว รองรับการปรับแต่งธีม Dark Slate Glassmorphism และ Shopee Orange Theme ได้อย่างลงตัว")

    add_h1("2.4 มาตรฐานความมั่นคงปลอดภัยและการชำระเงินดิจิทัล (Security Standards)")
    add_body("1) มาตรฐานคิวอาร์โค้ดทางการเงิน EMVCo และพร้อมเพย์: ระบบสร้างรหัส QR ตามข้อกำหนด PromptPay Specification รองรับการระบุรหัสผู้รับเงิน (Tax ID / Phone Number) และยอดเงินสุทธิ พร้อมคำนวณ Checksum ด้วยขั้นตอนวิธี CRC16-CCITT (Polynomial 0x1021) ป้องกันความผิดพลาดในการสแกนชำระเงิน")
    add_body("2) การควบคุมสิทธิ์การเข้าถึงตามบทบาท (Role-Based Access Control: RBAC): แยกบทบาทผู้ใช้เป็น 3 ระดับ ได้แก่ Customer, Merchant, และ Super Admin พร้อม Protected Route Guards ป้องกันการเข้าถึงหน้าจอที่ไม่ได้รับอนุญาต")
    add_body("3) การป้องกันการโจมตีเว็บ (Application Hardening): ติดตั้ง Helmet Security Headers, Content Security Policy (CSP), Cross-Origin Resource Sharing (CORS), และ Express Rate Limiters ป้องกันการยิงคำขอซ้ำซ้อน (Brute-force / DDoS)")
    add_body("4) การคุ้มครองข้อมูลส่วนบุคคล (PDPA Compliance): มีระบบขอความยินยอมใช้งานคุกกี้ (Cookie Consent Banner) และการจัดเก็บข้อมูลส่วนบุคคลเท่าที่จำเป็นตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562")

    add_h1("2.5 แนวคิด Vibe Coding และ Generative AI ในวิศวกรรมซอฟต์แวร์")
    add_body("Vibe Coding เป็นกระบวนทัศน์การพัฒนาซอฟต์แวร์ยุคใหม่ที่ผู้พัฒนาใช้ภาษาธรรมชาติในการสื่อสารความต้องการ วิสัยทัศน์ และตรรกะทางธุรกิจร่วมกับโมเดลภาษาขนาดใหญ่ (Large Language Models: LLMs) เช่น Google Gemini API เพื่อสังเคราะห์โค้ดและส่วนประกอบของระบบ โดยมีวงจรการทำงานสำคัญ 4 ขั้นตอน ได้แก่:")
    add_body("1) Blueprint Formulation: ออกแบบภาพร่างเค้าโครง (Layout Wireframe) ด้วย Canva AI")
    add_body("2) Code Synthesis: ให้ Generative AI แปลง Blueprint สู่ Functional React Components")
    add_body("3) Human-in-the-Loop Validation: ผู้พัฒนาตรวจสอบความถูกต้องของสถาปัตยกรรม ความปลอดภัย และตรรกะทางคณิตศาสตร์")
    add_body("4) Rapid Iteration: ปรับปรุงข้อบกพร่องตาม Feedback ของผู้ใช้งานจริงอย่างรวดเร็ว")

    add_caption("ภาพที่ 2.2 วงจรการพัฒนาซอฟต์แวร์ด้วยระเบียบวิธี Vibe Coding ร่วมกับ Generative AI")

    # =========================================================================
    # บทที่ 3: วิธีการดำเนินงานและการออกแบบระบบ (CHAPTER 3: SYSTEM DESIGN)
    # =========================================================================
    doc.add_page_break()
    add_heading_chapter("บทที่ 3", "วิธีการดำเนินงานและการออกแบบระบบ (System Design & Methodology)")

    add_h1("3.1 การวิเคราะห์ความต้องการของระบบ (System Requirements Analysis)")
    add_body("คณะผู้จัดทำได้วิเคราะห์และจำแนกความต้องการของระบบออกเป็น 2 ส่วนหลัก:")
    add_body("1) ความต้องการเชิงหน้าที่ (Functional Requirements):")
    add_body("   - ฝั่งลูกค้า: ค้นหาเมนูด้วยภาษาธรรมชาติ, กรองตามหมวดหมู่ 18 ชนิด, เลือกเวลานัดรับอาหาร 15 นาที, คำนวณราคารวมตามจำนวนคน, สแกนจ่ายด้วย PromptPay QR, ดูบัตรคิวดิจิทัลสดพร้อมเสียงเตือน, สะสมแต้ม CRM Points และใช้คูปอง")
    add_body("   - ฝั่งร้านค้า: เข้าถึงหน้าจอครัว KDS Kanban, รับฟังเสียงเตือนออเดอร์ใหม่, กดเปลี่ยนสถานะคิว (รอทำ -> กำลังปรุง -> เสร็จแล้ว), จัดการสต็อกเปิด-ปิดเมนูหมด")
    add_body("   - ฝั่งผู้ดูแลระบบ: ตรวจสอบสถิติยอดขายภาพรวม, อนุมัติร้านค้าใหม่, ตรวจสอบ Audit Log และควบคุมความปลอดภัย")
    add_body("2) ความต้องการที่ไม่ใช่เชิงหน้าที่ (Non-Functional Requirements):")
    add_body("   - ประสิทธิภาพ (Performance): หน้าจอต้องโหลดได้ภายในเวลาไม่เกิน 2.0 วินาทีบนเครือข่าย 4G/5G")
    add_body("   - ความสามารถในการใช้งาน (Usability): รองรับ Fluid Zoom Scaling (Ctrl + / Ctrl -) ตั้งแต่ 50% ถึง 200% โดยที่องค์ประกอบไม่แตกและไม่มีพื้นที่ว่างสีขาวใต้ Footer")
    add_body("   - ความทนทาน (Reliability): มีระบบ LocalStorage Fallback ป้องกันการสูญหายของบัตรคิวเมื่อออฟไลน์")

    # Table 3.1
    tbl_rbac = doc.add_table(rows=0, cols=3)
    tbl_rbac.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_rbac, color="CBD5E1", sz="3")
    hrb = tbl_rbac.add_row().cells
    hrb[0].paragraphs[0].add_run("บทบาท (Role)").bold = True
    hrb[1].paragraphs[0].add_run("สิทธิ์การเข้าถึง (Permissions)").bold = True
    hrb[2].paragraphs[0].add_run("เส้นทางหน้าจอ (Allowed Routes)").bold = True
    set_cell_background(hrb[0], "F1F5F9")
    set_cell_background(hrb[1], "F1F5F9")
    set_cell_background(hrb[2], "F1F5F9")

    rbac_rows = [
        ("Customer\n(นักเรียน/บุคลากร)", "สั่งจองล่วงหน้า, สแกนจ่าย PromptPay, ถือบัตรคิว, สะสมแต้ม CRM Points (128 แต้ม), ใช้คูปอง WELCOME50", "/, /home, /search, /store/*, /food/*, /profile, /queue-tracking, /chat"),
        ("Merchant\n(ร้านค้าโรงอาหาร)", "เข้าถึงหน้าจอครัว KDS, ฟังเสียงเตือนออเดอร์, อัปเดตสถานะคิว, จัดการเมนูอาหารและยอดขาย", "สิทธิ์ของลูกค้าทั้งหมด + /merchant, /kds, /store-admin, /store-chat"),
        ("Super Admin\n(ผู้ดูแลระบบโรงอาหาร)", "ดูภาพรวมสถิติทั้งโรงอาหาร, จัดการร้านค้าพันธมิตร, ตรวจสอบ Audit Log, ควบคุมความปลอดภัย", "ทุกหน้าจอในระบบ + /admin, /admin-dashboard")
    ]
    for ro, pe, rt in rbac_rows:
        r = tbl_rbac.add_row().cells
        r[0].paragraphs[0].add_run(ro).font.size = Pt(14)
        r[1].paragraphs[0].add_run(pe).font.size = Pt(14)
        r[2].paragraphs[0].add_run(rt).font.size = Pt(13)
    add_caption("ตารางที่ 3.1 สิทธิ์การเข้าถึงและการดำเนินงานตามบทบาท (RBAC Permission Matrix)")

    add_h1("3.2 สถาปัตยกรรมระบบและการไหลของข้อมูล (System Architecture & DFD)")
    add_body("ระบบ QueueUp ใช้สถาปัตยกรรมแบบ 3 ชั้น (3-Tier Layered Architecture) ประกอบด้วย:")
    add_body("1) ชั้นการแสดงผล (Presentation Layer): พัฒนาด้วย React 19 SPA ทำงานบนเบราว์เซอร์ของผู้ใช้ จัดการแสดงผลผ่าน Responsive Components และ Dynamic Routing")
    add_body("2) ชั้นตรรกะและการบริการ (Application & Business Logic Layer): ให้บริการผ่าน Express Node.js Cloud API ควบคุมกฎการจองสล็อตเวลา, การออกรหัสคิว, การตรวจสอบสลิป, และการเชื่อมต่อ Google GenAI")
    add_body("3) ชั้นข้อมูล (Data Persistence Layer): จัดเก็บข้อมูลบน Google Cloud Firestore พร้อมระบบแคชสำรอง LocalStorage ในฝั่งไคลเอนต์")

    add_caption("ภาพที่ 3.1 สถาปัตยกรรมระบบ 3 ชั้น (3-Tier Architecture) ของเว็บแอปพลิเคชัน QueueUp")
    add_caption("ภาพที่ 3.2 แผนภาพการไหลของข้อมูล (Data Flow Diagram - Level 1)")

    add_h1("3.3 การออกแบบฐานข้อมูล (Database Schema Design)")
    add_body("ระบบจัดเก็บข้อมูลใน Google Cloud Firestore โดยแบ่งออกเป็น 5 คอลเลกชันหลัก ดังนี้:")
    add_body("1) คอลเลกชัน users: บันทึกข้อมูลบัญชีผู้ใช้ บทบาทสิทธิ์ (role), แต้มสะสม CRM Points, และประวัติการรับคูปองส่วนลด")
    add_body("2) คอลเลกชัน products: บันทึกรายการอาหาร ราคาปกติ ราคาลดตามช่วงเวลา หมวดหมู่ (18 ชนิด) รูปภาพ และชื่อร้านค้า")
    add_body("3) คอลเลกชัน orders: บันทึกคำสั่งซื้อ รหัสคิว (queueNo), สล็อตเวลานัดรับ, สถานะการปรุง, สลิปโอนเงิน และยอดชำระ")
    add_body("4) คอลเลกชัน shops: บันทึกข้อมูลร้านค้า พิกัดโรงอาหาร เวลาเปิด-ปิด และเวลารอคิวเฉลี่ย")
    add_body("5) คอลเลกชัน categories: บันทึกหมวดหมู่อาหารทั้ง 18 หมวดหมู่ พร้อมไอคอนและชื่อภาษาไทย/อังกฤษ")

    add_h1("3.4 การออกแบบส่วนติดต่อผู้ใช้และระบบ Fluid Zoom Scaling (UX/UI Design)")
    add_body("หนึ่งในนวัตกรรมสำคัญของ QueueUp คือการออกแบบระบบ Fluid Zoom Scaling ซึ่งแก้ไขปัญหาข้อบกพร่องที่พบบ่อยในเว็บแอปพลิเคชันทั่วไป เมื่อผู้ใช้กดซูมเข้าหรือซูมออกบนเบราว์เซอร์ (Ctrl + / Ctrl -) โครงสร้างหน้าจอมักจะล้นหรือเกิดขอบสีขาวว่างด้านล่าง คณะผู้จัดทำได้วางสถาปัตยกรรม CSS ด้วยการใช้ฟังก์ชัน clamp() ทางคณิตศาสตร์ เช่น `max-width: clamp(1200px, 92vw, 1680px)` ร่วมกับโครงสร้าง Flexbox Sticky Footer ที่ระดับรากฐานของ HTML/Body ทำให้หน้าจอคงสัดส่วนที่สวยงามและเต็มหน้าจอเสมอในทุกระดับการซูมตั้งแต่ 50% ถึง 200%")

    add_caption("ภาพที่ 3.4 โครงสร้างเลย์เอาต์ Fluid Zoom Scaling และ Sticky Footer")

    add_h1("3.5 ขั้นตอนวิธีและตรรกะสำคัญของระบบ (Core Algorithms)")
    add_body("คณะผู้จัดทำได้ออกแบบขั้นตอนวิธีสำคัญ 3 รายการ ดังนี้:")
    add_body("1) ขั้นตอนวิธีจองสล็อตเวลาแบบป้องกัน Concurrency (Time-Slot Booking Algorithm):")
    add_body("   ใช้กลไก Distributed Database Transaction ในการตรวจสอบความจุของสล็อตเวลา หากความจุคงเหลือ (Available Capacity) มีค่าน้อยกว่าจำนวนรายการอาหารในออเดอร์ ระบบจะยกเลิกคำขอทันทีและแนะนำให้ผู้ใช้เลือกสล็อตถัดไป ป้องกันปัญหาการรับออเดอร์เกินกำลังการผลิตของครัว")
    add_body("2) ขั้นตอนวิธีสร้าง Dynamic PromptPay QR Code พร้อม Checksum CRC16:")
    add_body("   สร้างสตริงข้อมูลตามมาตรฐาน EMVCo ประกอบด้วย Payload Format Indicator, Point of Initiation Method, Merchant Account Information (เบอร์โทร/Tax ID), Transaction Currency (764 สำหรับบาทไทย), Transaction Amount, และคำนวณ CRC16-CCITT แบบ Polynomial 0x1021 เพื่อปิดท้ายสตริง")
    add_body("3) ขั้นตอนวิธีระบบเสียงแจ้งเตือนด้วย Web Audio API:")
    add_body("   สร้างสัญญาณเสียงกระดิ่ง (Audio Chime) สังเคราะห์ผ่าน OscillatorNode ความถี่ 587.33 Hz (D5) และ 880.00 Hz (A5) ร่วมกับ GainNode สำหรับควบคุมความดังและการ Fade-out อย่างนุ่มนวล โดยไม่ต้องพึ่งพาการดาวน์โหลดไฟล์เสียงภายนอก")

    add_h1("3.6 กลยุทธ์การทดสอบและการประกันคุณภาพซอฟต์แวร์ (Testing Strategy)")
    add_body("โครงการใช้แนวทางการทดสอบแบบหลายระดับ (Multi-Tier Testing Hierarchy) ประกอบด้วย:")
    add_body("1) Server Unit Tests: ทดสอบตรรกะการคำนวณราคา การคำนวณส่วนลด และการจัดการความจุสล็อตเวลา")
    add_body("2) Firestore Rules Testing: ทดสอบกฎความปลอดภัยของฐานข้อมูลด้วย Firebase Rules Unit Testing Emulator ยืนยันการป้องกันการเข้าถึงข้ามสิทธิ์")
    add_body("3) End-to-End (E2E) Testing: ทดสอบจำลองขั้นตอนการใช้งานตั้งแต่การค้นหาอาหาร, สั่งจอง, ชำระเงิน, จนถึงการอัปเดตสถานะในหน้าจอ KDS ด้วย Playwright")
    add_body("4) Ledger Integrity Tests: ทดสอบความถูกต้องของบัญชีธุรกรรมสองทาง (Double-Entry Ledger) ป้องกันการเกิดเงินสูญหายหรือแต้มสะสมผิดพลาด")

    # =========================================================================
    # บทที่ 4: ผลการดำเนินงานและการประเมินผล (CHAPTER 4: IMPLEMENTATION & EVALUATION)
    # =========================================================================
    doc.add_page_break()
    add_heading_chapter("บทที่ 4", "ผลการดำเนินงานและการประเมินผล (Implementation & Evaluation)")

    add_h1("4.1 ผลการพัฒนาฟังก์ชันการทำงานหลัก 9 โมดูล (Functional Modules Implementation)")
    add_body("คณะผู้จัดทำได้พัฒนาเว็บแอปพลิเคชัน QueueUp เวอร์ชัน v2.5.0 สำเร็จสมบูรณ์ โดยมีฟังก์ชันการทำงานหลัก 9 โมดูล ดังนี้:")
    add_body("1) โมดูลค้นหาอัจฉริยะ (AI Smart Search): ประมวลผลข้อความค้นหาภาษาธรรมชาติ (NLP) เช่น 'อยากกินเผ็ดๆ', 'ไม่เกิน 50 บาท' ร่วมกับแคโรเซลหมวดหมู่อาหาร 18 หมวดหมู่")
    add_body("2) โมดูลนำเสนออาหารยอดนิยม (Food Discovery & Hero Showcase): แบนเนอร์ข่าวสาร, ปุ่มกดรับคูปอง WELCOME50 ในคลิกเดียว, และแคโรเซล 10 เมนูขายดีประจำโรงอาหารที่คำนวณจากยอดขายจริง (salesCount)")
    add_body("3) โมดูลสั่งจองล่วงหน้าตามสล็อตเวลา (Pre-Order & Time-Slot Booking): เลือกเวลานัดรับล่วงหน้าทุก 15 นาที พร้อมส่วนลดจูงใจแบบไดนามิก และตัวคูณจำนวนผู้รับประทาน (Guest Multiplier)")
    add_body("4) โมดูลชำระเงินไร้สัมผัสและจำลองตรวจสลิป: สร้าง Dynamic PromptPay QR Code อัตโนมัติ พร้อมระบบจำลองตรวจสลิปใน 1.2 วินาที และเวลานับถอยหลัง 15 นาที")
    add_body("5) โมดูลบัตรคิวดิจิทัลและการติดตามสด: ออกหมายเลขคิวแยกตามร้านค้า แสดงสถานะสด 3 ขั้น (TO_PAY -> TO_SHIP -> COMPLETED) พร้อมเสียงกระดิ่งเตือนเมื่ออาหารเสร็จ")
    add_body("6) โมดูลหน้าจอครัว KDS (Kitchen Display System): หน้าจอครัว Kanban บอร์ดสำหรับแม่ค้า อัปเดตสถานะออเดอร์ในคลิกเดียว พร้อมเสียงเตือนออเดอร์เข้า")
    add_body("7) โมดูลโปรไฟล์ผู้ใช้และแต้มสะสม CRM: กระเป๋าแต้มสะสม 128 แต้ม, กระเป๋าคูปองส่วนลด, และปุ่มสั่งซ้ำเมนูเดิมทันที (1-Click Re-order)")
    add_body("8) โมดูลความปลอดภัยและสิทธิ์ผู้ใช้: แยกสิทธิ์ RBAC 3 ระดับ, เกราะป้องกัน XSS/Injection, และแถบขอความยินยอมตามกฎหมาย PDPA")
    add_body("9) โมดูล Fluid Zoom Scaling และ Accessibility: หน้าจอยืดหยุ่นรองรับการซูม 50%-200% สัดส่วนไม่เพี้ยน พร้อมระบบสลับภาษาไทย/อังกฤษ และแชทสด")

    add_caption("ภาพที่ 4.1 หน้าแรกของแอปพลิเคชัน (Homepage) พร้อม Hero Carousel และหมวดหมู่ 18 ชนิด")
    add_caption("ภาพที่ 4.2 หน้าจอสั่งจองอาหารล่วงหน้าตามสล็อตเวลา (Time-Slot Booking & Discount Engine)")
    add_caption("ภาพที่ 4.3 หน้าจอบัตรคิวดิจิทัลสด (Live Digital Queue Ticket) พร้อม PromptPay QR Code")
    add_caption("ภาพที่ 4.4 หน้าจอครัวสำหรับร้านค้า (Kitchen Display System - KDS Kanban Board)")

    add_h1("4.2 ผลการทดสอบเชิงประจักษ์ภาคสนามในมหาวิทยาลัยขอนแก่น (KKU Canteen Survey)")
    add_body("คณะผู้จัดทำได้นำระบบต้นแบบ QueueUp ไปทดสอบและเก็บข้อมูลการประเมินจากกลุ่มตัวอย่างจริงในพื้นที่มหาวิทยาลัยขอนแก่น จำนวน 110 ราย จาก 16 คณะวิชา ผ่านแบบประเมินความพึงพอใจมาตรวัด Likert Scale 5 ระดับ (15 ข้อคำถาม) โดยผลการประเมินสรุปแยกตาม 5 มิติหลัก ได้ดังแสดงในตารางที่ 4.2:")

    # Table 4.2
    tbl_surv = doc.add_table(rows=0, cols=4)
    tbl_surv.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_surv, color="CBD5E1", sz="3")
    hs = tbl_surv.add_row().cells
    hs[0].paragraphs[0].add_run("มิติการประเมินความพึงพอใจ").bold = True
    hs[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    hs[1].paragraphs[0].add_run("คะแนนเฉลี่ย\n(เต็ม 5.00)").bold = True
    hs[2].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    hs[2].paragraphs[0].add_run("ร้อยละ\n(%)").bold = True
    hs[3].paragraphs[0].add_run("ระดับความพึงพอใจ").bold = True
    set_cell_background(hs[0], "F1F5F9")
    set_cell_background(hs[1], "F1F5F9")
    set_cell_background(hs[2], "F1F5F9")
    set_cell_background(hs[3], "F1F5F9")

    surv_data = [
        ("1. ด้านความสะดวกรวดเร็วในการสั่งอาหารล่วงหน้า", "4.78", "95.6%", "มากที่สุด"),
        ("2. ด้านความถูกต้องของบัตรคิวและระบบเสียงเตือน", "4.72", "94.4%", "มากที่สุด"),
        ("3. ด้านความง่ายในการชำระเงินผ่าน PromptPay QR", "4.69", "93.8%", "มากที่สุด"),
        ("4. ด้านประสบการณ์การใช้งานหน้าจอ (UX/UI)", "4.61", "92.2%", "มากที่สุด"),
        ("5. ด้านประสิทธิภาพในการลดความแออัดของโรงอาหาร", "4.52", "90.4%", "มากที่สุด"),
        ("ภาพรวมความพึงพอใจทั้งหมด (15 ข้อคำถาม)", "4.66", "93.2%", "มากที่สุด")
    ]
    for d, s, p, l in surv_data:
        r = tbl_surv.add_row().cells
        p0 = r[0].paragraphs[0]
        run0 = p0.add_run(d)
        if "ภาพรวม" in d:
            run0.bold = True
        p1 = r[1].paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        run1 = p1.add_run(s)
        if "ภาพรวม" in d: run1.bold = True
        p2 = r[2].paragraphs[0]
        p2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        run2 = p2.add_run(p)
        if "ภาพรวม" in d: run2.bold = True
        p3 = r[3].paragraphs[0]
        run3 = p3.add_run(l)
        if "ภาพรวม" in d: run3.bold = True
    add_caption("ตารางที่ 4.2 ผลการประเมินความพึงพอใจการใช้งานโรงอาหาร (KKU Canteen Survey 110 รายการ)")

    add_body("ผลการเปรียบเทียบระยะเวลาการรอคอยอาหารก่อนและหลังการใช้งานระบบ พบสถิติที่สำคัญดังแสดงในตารางที่ 4.3:")
    
    # Table 4.3
    tbl_time = doc.add_table(rows=0, cols=4)
    tbl_time.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_time, color="CBD5E1", sz="3")
    ht = tbl_time.add_row().cells
    ht[0].paragraphs[0].add_run("ตัวชี้วัดระยะเวลา").bold = True
    ht[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    ht[1].paragraphs[0].add_run("ก่อนใช้งานระบบ").bold = True
    ht[2].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    ht[2].paragraphs[0].add_run("หลังใช้งาน QueueUp").bold = True
    ht[3].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    ht[3].paragraphs[0].add_run("ผลการเปลี่ยนแปลง").bold = True
    set_cell_background(ht[0], "F1F5F9")
    set_cell_background(ht[1], "F1F5F9")
    set_cell_background(ht[2], "F1F5F9")
    set_cell_background(ht[3], "F1F5F9")

    time_rows = [
        ("เวลารอคิวสั่งอาหารหน้าร้าน", "8.5 นาที", "0.0 นาที (สั่งล่วงหน้า)", "ลดลง 100%"),
        ("เวลารอปรุงอาหารหน้าเคาน์เตอร์", "12.9 นาที", "6.2 นาที (เดินมารับพอดี)", "ลดลง 51.9%"),
        ("เวลารวมในการรอรับประทานอาหาร", "21.4 นาที", "6.2 นาที", "ลดลง 71.0% (15.2 นาที)"),
        ("ความตั้งใจใช้งานต่อในโรงอาหารจริง", "34.0%", "98.2%", "เพิ่มขึ้น 64.2%")
    ]
    for m, b, a, c in time_rows:
        r = tbl_time.add_row().cells
        r[0].paragraphs[0].add_run(m).font.size = Pt(14)
        r[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r[1].paragraphs[0].add_run(b).font.size = Pt(14)
        r[2].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r[2].paragraphs[0].add_run(a).font.size = Pt(14)
        r[3].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r[3].paragraphs[0].add_run(c).font.size = Pt(14)
    add_caption("ตารางที่ 4.3 เปรียบเทียบระยะเวลารอคอยอาหารก่อนและหลังการใช้งานระบบ QueueUp")

    add_caption("ภาพที่ 4.5 แผนภูมิแท่งเปรียบเทียบระยะเวลารอคอยอาหารเฉลี่ยก่อนและหลังใช้งาน")

    add_h1("4.3 ผลการประเมินสถาปัตยกรรมทางเทคนิค (System Architecture Evaluation)")
    add_body("คณะผู้จัดทำได้เปิดให้ผู้เชี่ยวชาญ นักพัฒนาระบบ และนักศึกษาสาขาปัญญาประดิษฐ์และวิทยาการคอมพิวเตอร์ ทำการประเมินสถาปัตยกรรมทางเทคนิคของระบบ จำนวน 107 รายการประเมิน ใน 5 มิติหลัก (คะแนนเต็ม 10.00 คะแนน) ผลการประเมินสรุปได้ดังตารางที่ 4.4:")

    # Table 4.4
    tbl_arch = doc.add_table(rows=0, cols=3)
    tbl_arch.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_arch, color="CBD5E1", sz="3")
    ha = tbl_arch.add_row().cells
    ha[0].paragraphs[0].add_run("มิติการประเมินทางเทคนิค").bold = True
    ha[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    ha[1].paragraphs[0].add_run("คะแนนเฉลี่ย (เต็ม 10.00)").bold = True
    ha[2].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    ha[2].paragraphs[0].add_run("ร้อยละ (%)").bold = True
    set_cell_background(ha[0], "F1F5F9")
    set_cell_background(ha[1], "F1F5F9")
    set_cell_background(ha[2], "F1F5F9")

    arch_rows = [
        ("1. User Experience & Fluid Zoom Scaling (UX/UI)", "9.73", "97.3%"),
        ("2. Account & RBAC Security Management", "9.75", "97.5%"),
        ("3. Queue Synchronization Engine", "9.68", "96.8%"),
        ("4. Merchant Kitchen Display System (KDS)", "9.69", "96.9%"),
        ("5. Security & Data Hardening (CSP, PDPA)", "9.71", "97.1%"),
        ("คะแนนเฉลี่ยสถาปัตยกรรมรวม (Overall Architecture Mean)", "9.71", "97.1%")
    ]
    for d, s, p in arch_rows:
        r = tbl_arch.add_row().cells
        p0 = r[0].paragraphs[0]
        run0 = p0.add_run(d)
        if "คะแนนเฉลี่ย" in d: run0.bold = True
        p1 = r[1].paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        run1 = p1.add_run(s)
        if "คะแนนเฉลี่ย" in d: run1.bold = True
        p2 = r[2].paragraphs[0]
        p2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        run2 = p2.add_run(p)
        if "คะแนนเฉลี่ย" in d: run2.bold = True
    add_caption("ตารางที่ 4.4 ผลการประเมินสถาปัตยกรรมทางเทคนิค 5 มิติ (System Evaluation 107 รายการ)")

    add_caption("ภาพที่ 4.6 แผนภูมิเรดาร์แสดงผลการประเมินสถาปัตยกรรมระบบ 5 มิติ")

    add_h1("4.4 ผลการทดสอบความเสถียรและความพร้อมทางการเงิน (Money Readiness & Test Harness)")
    add_body("ระบบได้ผ่านการรันชุดทดสอบความปลอดภัยและความถูกต้องของธุรกรรมการเงิน (Automated Test Suite) ครบถ้วน 100% โดยไม่มีข้อผิดพลาด ได้แก่:")
    add_body("- การทดสอบ Double-Entry Ledger Integrity: ตรวจสอบความสมดุลของบัญชีเงินและแต้มสะสม")
    add_body("- การทดสอบ Capacity Concurrency Transaction: จำลองผู้ใช้ 100 คนกดจองสล็อตเวลาเดียวกัน พบว่าระบบล็อกความจุได้ถูกต้อง ไม่มี Overbooking")
    add_body("- การทดสอบ Firestore Rules Emulator: ตรวจสอบการบล็อกสิทธิ์การเข้าถึงข้อมูลข้ามร้านค้าได้ 100%")

    # =========================================================================
    # บทที่ 5: สรุปผล อภิปรายผล และข้อเสนอแนะ (CHAPTER 5: CONCLUSION & DISCUSSION)
    # =========================================================================
    doc.add_page_break()
    add_heading_chapter("บทที่ 5", "สรุปผล อภิปรายผล และข้อเสนอแนะ (Conclusion & Discussion)")

    add_h1("5.1 สรุปผลการดำเนินโครงการ (Conclusion of the Project)")
    add_body("โครงการพัฒนานวัตกรรมเว็บแอปพลิเคชัน QueueUp (คิวอัป) บรรลุผลสัมฤทธิ์ตามวัตถุประสงค์ที่ตั้งไว้ทุกประการ คณะผู้จัดทำสามารถบูรณาการกระบวนการคิดเชิงคำนวณ (Computational Thinking) ทั้ง 4 เสาหลัก เข้ากับระเบียบวิธี Vibe Coding และ Generative AI ในการพัฒนาเว็บแอปพลิเคชันต้นแบบเวอร์ชัน v2.5.0 ที่พร้อมใช้งานจริงบนระบบคลาวด์")

    add_body("ระบบสามารถแก้ไขปัญหาคอขวดในโรงอาหารได้อย่างเป็นรูปธรรม จากผลการทดสอบภาคสนามกับกลุ่มตัวอย่าง 110 รายในมหาวิทยาลัยขอนแก่น พบว่าระบบช่วยลดระยะเวลารอคอยอาหารเฉลี่ยลงได้ถึง 71.0% (จาก 21.4 นาที เหลือเพียง 6.2 นาที) ได้รับคะแนนความพึงพอใจในระดับมากที่สุดที่ 4.66 จาก 5.00 คะแนน (93.2%) และได้รับคะแนนประเมินสถาปัตยกรรมทางเทคนิค 9.71 จาก 10.00 คะแนน (97.1%) อีกทั้งผ่านการทดสอบความพร้อมทางการเงินและความมั่นคงปลอดภัย 100%")

    add_h1("5.2 อภิปรายผลการวิจัยเชิงวิเคราะห์ (Analytical Discussion)")
    add_body("1) ประสิทธิผลของการเกลี่ยความต้องการด้วยสล็อตเวลา (Time-Slot Smoothing): สอดคล้องกับทฤษฎีแถวคอยที่ระบุว่า เมื่อกระจายอัตราการมาถึง (λ) ไม่ให้พุ่งสูงเกินขีดความสามารถของครัว (μ) ระบบจะสามารถรักษาสถานะเสถียรภาพได้ตลอดช่วงเวลาเร่งด่วน โดยแรงจูงใจด้วยส่วนลดแบบไดนามิกมีอิทธิพลอย่างยิ่งต่อการตัดสินใจปรับเปลี่ยนเวลาพักรับประทานอาหารของนักศึกษา")
    add_body("2) ผลกระทบเชิงบวกของระบบเสียงเตือน Web Audio API: การมีเสียงกระดิ่งเตือนเมื่ออาหารเสร็จช่วยลดความเครียดและความวิตกกังวลของผู้ใช้ ทำให้ไม่ต้องยืนจ้องหน้าจอโทรศัพท์หรือยืนออหน้าเคาน์เตอร์ ส่งผลให้พื้นที่ทางเดินในโรงอาหารมีความเป็นระเบียบเรียบร้อยมากขึ้นอย่างเห็นได้ชัด")
    add_body("3) ประสิทธิภาพของสถาปัตยกรรมไฮบริด Dual Persistence: การผสาน Cloud Firestore ร่วมกับ LocalStorage Fallback ช่วยแก้ปัญหาจุดบอดเรื่องสัญญาณอินเทอร์เน็ตหน่วงในอาคารโรงอาหารได้อย่างมีประสิทธิภาพ ผู้ใช้ยังสามารถถือบัตรคิวและตรวจสอบเลขออเดอร์ของตนเองได้แม้สัญญาณขาดหายชั่วคราว")

    add_h1("5.3 ข้อจำกัดของระบบในปัจจุบัน (Technical Limitations)")
    add_body("1) ภาวะ Cold Start ของฟังก์ชัน Serverless: ในกรณีที่ไม่มีผู้ใช้งานติดต่อกันเป็นเวลานาน คำขอแรกของการเรียกใช้งาน API บนคลาวด์อาจมีความล่าช้าประมาณ 1.5 ถึง 2.5 วินาที")
    add_body("2) การตรวจสอบสลิปโอนเงิน (OCR Slip Verification): ระบบในเวอร์ชัน v2.5 ยังเป็นระบบจำลองการตรวจสอบสลิป (Simulation Mode) ยังไม่ได้เชื่อมต่อ API จริงกับธนาคารแห่งประเทศไทยหรือธนาคารพาณิชย์โดยตรง ทำให้ในทางปฏิบัติยังต้องอาศัยการตรวจยอดเงินเข้าในแอปพลิเคชันธนาคารของร้านค้าร่วมด้วย")
    add_body("3) การรับรู้พิกัดตำแหน่งในอาคาร (Indoor Positioning): ระบบยังไม่สามารถระบุพิกัดตำแหน่งของผู้ใช้งานอย่างละเอียดภายในโรงอาหารแบบ 3 มิติได้ โดยอาศัยการแสดงผลชื่อโรงอาหาร หมายเลขอาคาร และหมายเลขเคาน์เตอร์เป็นข้อความแทน")

    add_h1("5.4 ข้อเสนอแนะในการพัฒนาต่อยอด (Future Recommendations)")
    add_body("1) การเชื่อมต่อระบบแจ้งเตือนผ่าน LINE Official Account (LINE Messaging API): เพื่อส่งข้อความแจ้งเตือนบัตรคิวและสถานะอาหารพร้อมรับตรงเข้าสู่ LINE ของนักศึกษาโดยไม่ต้องเปิดหน้าเว็บทิ้งไว้")
    add_body("2) การเชื่อมต่อ Open Banking API อย่างเป็นทางการ: พัฒนาการเชื่อมต่อร่วมกับผู้ให้บริการตรวจสอบสลิป เช่น SlipOK หรือ SCB Open API เพื่อยืนยันยอดเงินอัตโนมัติ 100%")
    add_body("3) การพัฒนาระบบพยากรณ์เวลาปรุงอาหารด้วย Machine Learning: นำสถิติประวัติการทำอาหารของแต่ละร้านตามช่วงเวลาและสภาพอากาศ มาสร้างโมเดล Random Forest หรือ LSTM เพื่อพยากรณ์เวลารอคอยที่แม่นยำระดับวินาที")
    add_body("4) การขยายผลสู่ศูนย์อาหารในโรงพยาบาลและศูนย์อาหารพาณิชย์: ปรับแต่งโครงสร้างระบบให้รองรับศูนย์อาหารในโรงพยาบาลรัฐ หรือฟู้ดคอร์ทในห้างสรรพสินค้าที่มีปริมาณผู้ใช้บริการหนาแน่น")

    # =========================================================================
    # ส่วนท้าย: บรรณานุกรม (REFERENCES)
    # =========================================================================
    doc.add_page_break()
    add_heading_chapter("บรรณานุกรม", "เอกสารอ้างอิง (References)")

    references = [
        ("กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม. (2562). ", "พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562. ", "ราชกิจจานุเบกษา เล่ม 136 ตอนที่ 69 ก."),
        ("ธนาคารแห่งประเทศไทย. (2561). ", "มาตรฐานการชำระเงินทางอิเล็กทรอนิกส์ด้วยคิวอาร์โค้ด (Thai QR Payment Standard). ", "กรุงเทพฯ: ธนาคารแห่งประเทศไทย."),
        ("วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น. (2567). ", "คู่มือและแนวปฏิบัติการจัดทำโครงงานทางวิทยาการคอมพิวเตอร์และเทคโนโลยีสารสนเทศ. ", "ขอนแก่น: มหาวิทยาลัยขอนแก่น."),
        ("EMVCo. (2020). ", "EMV® QR Code Specification for Payment Systems: Merchant-Presented Mode (Version 2.3). ", "EMVCo, LLC."),
        ("Google. (2024). ", "Gemini API Documentation and Generative AI SDK Reference. ", "Retrieved from https://ai.google.dev/docs"),
        ("Gross, D., Shortle, J. F., Thompson, J. M., & Harris, C. M. (2018). ", "Fundamentals of Queueing Theory (5th ed.). ", "Hoboken, NJ: John Wiley & Sons."),
        ("Meta Platforms. (2024). ", "React 19 Documentation: Actions, Server Components, and Optimistic UI. ", "Retrieved from https://react.dev"),
        ("Nielsen, J. (2020). ", "10 Usability Heuristics for User Interface Design. ", "Nielsen Norman Group. Retrieved from https://www.nngroup.com/articles/ten-usability-heuristics/"),
        ("OWASP Foundation. (2023). ", "OWASP Top Ten Web Application Security Risks. ", "Retrieved from https://owasp.org/www-project-top-ten/"),
        ("Russell, S., & Norvig, P. (2020). ", "Artificial Intelligence: A Modern Approach (4th ed.). ", "Upper Saddle River, NJ: Pearson."),
        ("Tailwind Labs. (2024). ", "Tailwind CSS v4.0: High-Performance CSS Framework. ", "Retrieved from https://tailwindcss.com"),
        ("Wing, J. M. (2006). ", "Computational thinking. ", "Communications of the ACM, 49(3), 33-35. https://doi.org/10.1145/1118178.1118215")
    ]

    for a, t, p in references:
        pref = doc.add_paragraph()
        pref.paragraph_format.first_line_indent = Inches(-0.5)
        pref.paragraph_format.left_indent = Inches(0.5)
        pref.paragraph_format.space_after = Pt(4)
        pref.paragraph_format.line_spacing = 1.15
        pref.add_run(a)
        pref.add_run(t).italic = True
        pref.add_run(p)

    # =========================================================================
    # ส่วนท้าย: ภาคผนวก (APPENDICES)
    # =========================================================================
    # ภาคผนวก ก: บันทึกการใช้ AI
    doc.add_page_break()
    add_heading_chapter("ภาคผนวก ก", "บันทึกการใช้ AI ในการพัฒนา (Vibe Coding Log)")
    add_h1("ก.1 วงจรการพัฒนาแบบวนซ้ำ 4 รอบ (Iteration Cycles)")
    add_body("การพัฒนาเว็บแอปพลิเคชัน QueueUp อาศัยการทำงานร่วมกันระหว่างคณะผู้จัดทำและ Generative AI ตามกระบวนการ Vibe Coding รวม 4 รอบการพัฒนา ดังนี้:")
    add_body("- รอบที่ 1 (Foundation & Discovery): แปลงภาพร่าง App Blueprint จาก Canva AI สู่โครงสร้าง React Components และวางระบบค้นหาภาษาธรรมชาติ (NLP)")
    add_body("- รอบที่ 2 (Time-Slot Booking Logic): สร้างอัลกอริทึมจัดการสล็อตเวลา 15 นาที ระบบคำนวณส่วนลดแบบพลวัต และตรรกะความจุครัว")
    add_body("- รอบที่ 3 (Real-Time Queue & Cashless Flow): สร้างระบบออกบัตรคิวดิจิทัลสด เชื่อมต่อ Dynamic PromptPay QR Code และหน้าจอครัว KDS")
    add_body("- รอบที่ 4 (Hardening, Fluid Scaling & Sound Chimes): ปรับแต่งระบบ Fluid Zoom Scaling ด้วย clamp(), เชื่อมต่อ Web Audio API สำหรับเสียงเตือน, และติดตั้งระบบขอความยินยอม PDPA")

    add_h1("ก.2 ตัวอย่างชุดคำสั่ง (Prompt Engineering Examples)")
    add_body("ตัวอย่างชุดคำสั่งสำคัญที่ใช้ในการสั่งการ AI ในการพัฒนา:")
    add_body("1) คำสั่งสร้างสถาปัตยกรรมระบบ:")
    add_body("   'ช่วยออกแบบโครงสร้าง React TypeScript Application สำหรับระบบโรงอาหาร QueueUp โดยแบ่งเป็น 3 สิทธิ์ (Customer, Merchant, Admin) ใช้ Context API ในการจัดการสถานะ รองรับ LocalStorage Fallback เมื่อออฟไลน์ และสร้าง Interface บัตรคิวที่มีสถานะ TO_PAY, TO_SHIP, COMPLETED'")
    add_body("2) คำสั่งแก้ปัญหา Responsive Zoom:")
    add_body("   'หน้าเว็บมีปัญหาเมื่อผู้ใช้กด Ctrl + หรือ Ctrl - ซูมเข้าออก ทำให้เกิดขอบขาวว่างด้านล่าง Footer และเลย์เอาต์หน้า ProductDetail แตก ช่วยเขียน CSS ด้วย clamp() และ Flexbox Sticky Footer ให้แสดงผลเต็มสัดส่วนจอเสมอ'")
    add_body("3) คำสั่งสร้างระบบเสียง Web Audio API:")
    add_body("   'เขียนฟังก์ชันสังเคราะห์เสียงกระดิ่ง (Audio Chime) ด้วย OscillatorNode ใน Web Audio API เพื่อเล่นเสียงเตือนเมื่อสถานะเปลี่ยนเป็น COMPLETED และเตือนเมื่อมีออเดอร์ใหม่ในหน้าจอ KDS โดยไม่ต้องดาวน์โหลดไฟล์เสียงภายนอก'")

    # ภาคผนวก ข: บันทึกข้อผิดพลาดและการแก้ไข
    doc.add_page_break()
    add_heading_chapter("ภาคผนวก ข", "บันทึกข้อผิดพลาดและการแก้ไข (Bug Log)")
    add_body("ตารางที่ ข.1 สรุปประเด็นข้อผิดพลาดสำคัญที่พบระหว่างการพัฒนาและการทดสอบ พร้อมวิธีการแก้ไขทางวิศวกรรมซอฟต์แวร์:")

    tbl_bug = doc.add_table(rows=0, cols=4)
    tbl_bug.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_bug, color="CBD5E1", sz="3")
    hb = tbl_bug.add_row().cells
    hb[0].paragraphs[0].add_run("รหัสบั๊ก").bold = True
    hb[1].paragraphs[0].add_run("ปัญหาที่ตรวจพบ").bold = True
    hb[2].paragraphs[0].add_run("สาเหตุที่แท้จริง").bold = True
    hb[3].paragraphs[0].add_run("วิธีการแก้ไขทางวิศวกรรม").bold = True
    set_cell_background(hb[0], "F1F5F9")
    set_cell_background(hb[1], "F1F5F9")
    set_cell_background(hb[2], "F1F5F9")
    set_cell_background(hb[3], "F1F5F9")

    bugs = [
        ("BUG-01\n(UI/UX)", "หน้าจอเพี้ยนเมื่อซูมเข้า/ออก (Ctrl +/-) เกิดพื้นที่สีขาวใต้ Footer และรูปเมนูอาหารขยายผิดสัดส่วน", "ขาดการกำหนด Aspect Ratio และคอนเทนเนอร์ขาดการตั้งค่า Global Fluid Scaling", "ปรับแต่ง CSS Grid ด้วย clamp(1200px, 92vw, 1680px) และจัดโครงสร้าง Flexbox Sticky Footer ให้แก่ #root (แก้ได้ 100%)"),
        ("BUG-02\n(Routing)", "เกิดข้อผิดพลาด HTTP 404 Not Found เมื่อรีเฟรชหน้าเว็บ Sub-route (/home, /search, /kds) บน Cloud Hosting", "เว็บไซต์เป็น Single Page Application (SPA) แต่ Hosting พยายามค้นหาไฟล์ตาม URL บนเซิร์ฟเวอร์", "สร้างไฟล์คอนฟิก public/_redirects และ vercel.json กำหนดกฎ /* /index.html 200 ส่งทุกคำขอกลับมาประมวลผลที่ React (แก้ได้ 100%)")
    ]
    for b_id, b_d, b_c, b_s in bugs:
        r = tbl_bug.add_row().cells
        r[0].paragraphs[0].add_run(b_id).font.size = Pt(13)
        r[1].paragraphs[0].add_run(b_d).font.size = Pt(13)
        r[2].paragraphs[0].add_run(b_c).font.size = Pt(13)
        r[3].paragraphs[0].add_run(b_s).font.size = Pt(13)
    add_caption("ตารางที่ ข.1 บันทึกข้อผิดพลาดและการแก้ไขระบบ (Bug Log)")

    # ภาคผนวก ค: แบบประเมินและสถิติภาคสนาม
    doc.add_page_break()
    add_heading_chapter("ภาคผนวก ค", "แบบประเมินความพึงพอใจและสถิติภาคสนาม (KKU Canteen Evaluation)")
    add_body("ตารางที่ ค.1 แสดงผลการประเมินความพึงพอใจรายข้อคำถาม (15 ข้อคำถาม) จากกลุ่มตัวอย่าง 110 ราย ใน 16 คณะวิชา มหาวิทยาลัยขอนแก่น:")

    tbl_kku_q = doc.add_table(rows=0, cols=3)
    tbl_kku_q.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(tbl_kku_q, color="CBD5E1", sz="3")
    hk = tbl_kku_q.add_row().cells
    hk[0].paragraphs[0].add_run("ข้อคำถามในการประเมินความพึงพอใจ (15 ข้อคำถาม)").bold = True
    hk[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    hk[1].paragraphs[0].add_run("คะแนนเฉลี่ย\n(เต็ม 5.00)").bold = True
    hk[2].paragraphs[0].add_run("ระดับความคิดเห็น").bold = True
    set_cell_background(hk[0], "F1F5F9")
    set_cell_background(hk[1], "F1F5F9")
    set_cell_background(hk[2], "F1F5F9")

    kku_questions = [
        ("1. การสั่งจองอาหารล่วงหน้าช่วยประหยัดเวลาการรอคอยหน้าเคาน์เตอร์", "4.82", "มากที่สุด"),
        ("2. ตัวเลือกระบุเวลานัดรับอาหาร 15 นาที มีความยืดหยุ่นและเหมาะสม", "4.75", "มากที่สุด"),
        ("3. ส่วนลดพิเศษตามช่วงเวลา (Off-Peak Discount) จูงใจให้สั่งในเวลาคนน้อย", "4.76", "มากที่สุด"),
        ("4. ความชัดเจนและถูกต้องของหมายเลขบัตรคิวดิจิทัล", "4.74", "มากที่สุด"),
        ("5. การแจ้งเตือนด้วยเสียงกระดิ่งเมื่ออาหารเสร็จมีความสะดวกและทันเวลา", "4.70", "มากที่สุด"),
        ("6. การแสดงข้อมูลเคาน์เตอร์และชื่อโรงอาหารมีความชัดเจน", "4.71", "มากที่สุด"),
        ("7. ความสะดวกรวดเร็วในการสแกนจ่ายผ่าน Dynamic PromptPay QR Code", "4.72", "มากที่สุด"),
        ("8. ความน่าเชื่อถือของระบบจำลองตรวจสอบสลิปโอนเงิน", "4.65", "มากที่สุด"),
        ("9. ความมั่นใจในความปลอดภัยของการทำธุรกรรมไร้เงินสด", "4.69", "มากที่สุด"),
        ("10. ความสวยงามและความทันสมัยของหน้าจอแอปพลิเคชัน (UI Design)", "4.64", "มากที่สุด"),
        ("11. ความง่ายในการค้นหาเมนูอาหารและตัวกรองภาษาธรรมชาติ (NLP Search)", "4.60", "มากที่สุด"),
        ("12. การแสดงผลหน้าจอมีความคมชัดและยืดหยุ่นเมื่อซูมเข้า/ออก (Fluid Zoom)", "4.60", "มากที่สุด"),
        ("13. ระบบบัตรคิวดิจิทัลช่วยลดความแออัดหน้าเคาน์เตอร์ร้านค้าได้จริง", "4.56", "มากที่สุด"),
        ("14. ความเป็นระเบียบเรียบร้อยในโรงอาหารดีขึ้นเมื่อมีระบบคิว", "4.50", "มากที่สุด"),
        ("15. ความต้องการให้ติดตั้งและใช้งาน QueueUp ในทุกโรงอาหารของมหาวิทยาลัย", "4.85", "มากที่สุด"),
        ("คะแนนเฉลี่ยรวมทุกข้อคำถาม (Overall Mean Score)", "4.66", "มากที่สุด (93.2%)")
    ]
    for q_t, q_s, q_l in kku_questions:
        r = tbl_kku_q.add_row().cells
        p0 = r[0].paragraphs[0]
        run0 = p0.add_run(q_t).font.size = Pt(13)
        if "คะแนนเฉลี่ยรวม" in q_t: run0.bold = True
        p1 = r[1].paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        run1 = p1.add_run(q_s).font.size = Pt(13)
        if "คะแนนเฉลี่ยรวม" in q_t: run1.bold = True
        p2 = r[2].paragraphs[0]
        run2 = p2.add_run(q_l).font.size = Pt(13)
        if "คะแนนเฉลี่ยรวม" in q_t: run2.bold = True
    add_caption("ตารางที่ ค.1 สรุปสถิติคะแนนความพึงพอใจรายข้อ 15 ข้อคำถาม จาก 16 คณะวิชา")

    # ภาคผนวก ง: ข้อมูลการเข้าถึงระบบ
    doc.add_page_break()
    add_heading_chapter("ภาคผนวก ง", "ข้อมูลการเข้าถึงระบบและคู่มือการติดตั้ง (Access & Manual)")
    add_h1("ง.1 ช่องทางการเข้าถึงระบบซอฟต์แวร์")
    add_body("คณะกรรมการและผู้สนใจสามารถเข้าถึงซอร์สโค้ดและระบบทดสอบได้ผ่านลิงก์ต่อไปนี้:")
    add_body("1) คลังรหัสต้นฉบับบน GitHub (Repository):")
    add_body("   URL: https://github.com/easy-web-p/Queue-up.git (Branch: main)")
    add_body("2) เว็บแอปพลิเคชันใช้งานจริงบนเซิร์ฟเวอร์คลาวด์ (Vercel Production):")
    add_body("   URL: https://queue-up-nu.vercel.app")
    add_body("3) หน้านำเสนอข้อมูลและรายงานสรุปวิชาการ 12 หน้า (About / Showcase Page):")
    add_body("   URL: https://queue-up-nu.vercel.app/about")
    add_body("4) ระบบสำรองต้นแบบ (Prototype Mirror):")
    add_body("   URL: https://queueup-school.netlify.app")

    add_h1("ง.2 ขั้นตอนการติดตั้งและทดสอบในเครื่องคอมพิวเตอร์ (Local Installation)")
    add_body("1. ดาวน์โหลดโค้ดต้นฉบับ: git clone https://github.com/easy-web-p/Queue-up.git")
    add_body("2. เข้าสู่โฟลเดอร์โปรเจกต์: cd Queue-up")
    add_body("3. ติดตั้งแพ็กเกจที่จำเป็น: npm install")
    add_body("4. รันระบบสำหรับการพัฒนา: npm run dev")
    add_body("5. ทดสอบรันชุดทดสอบอัตโนมัติ: npm test")

    # =========================================================================
    # ส่วนท้าย: ประวัติผู้จัดทำ (AUTHORS' BIOGRAPHY)
    # =========================================================================
    doc.add_page_break()
    add_heading_chapter("ประวัติผู้จัดทำ", "คณะผู้จัดทำ กลุ่ม 23 (91)")

    authors_bio = [
        ("1. นายพิสิษฐ์ แก้วกุลพิสิษฐ", "693380082-8", "UX/UI Lead & Frontend Experience Lead",
         "รับผิดชอบการออกแบบประสบการณ์ผู้ใช้ (UX), ออกแบบหน้าจอ Interface ตามหลัก Glassmorphism และพัฒนาระบบ Fluid Zoom Scaling รองรับการขยายจอ"),
        ("2. นายภานุ คำแก้ว", "693380586-0", "Backend & Database Architecture Lead",
         "รับผิดชอบการออกแบบสถาปัตยกรรม Cloud Firestore Schemas, การพัฒนาระบบ LocalStorage Fallback และการกำหนดสิทธิ์ RBAC 3 ระดับ"),
        ("3. นายภูริทัต มหานิล", "693380588-6", "AI & Core Feature Developer Lead",
         "รับผิดชอบการพัฒนาระบบค้นหาอัจฉริยะ (NLP Search Engine), ระบบคำนวณส่วนลดสล็อตเวลา (Time-Slot Booking) และระบบตะกร้าสินค้า"),
        ("4. นายพลกฤต นิลอยู่", "693380584-4", "KDS & Payment Integration Lead",
         "รับผิดชอบการพัฒนาหน้าจอครัว Kanban สำหรับร้านค้า (Kitchen Display System), ระบบเสียงแจ้งเตือน Web Audio API และระบบ Dynamic PromptPay QR"),
        ("5. นายภาสกร หนองรั้ง", "693380587-8", "CRM & Loyalty Program Lead",
         "รับผิดชอบการพัฒนาระบบกระเป๋าแต้มสะสม CRM Points (128 แต้ม), ระบบคูปองส่วนลดสมาชิกใหม่ และระบบ 1-Click Quick Re-order"),
        ("6. นายคณิศร เลิศร่วมพัฒนา", "693380570-5", "QA Tester & Bug Hunter Lead",
         "รับผิดชอบการทดสอบระบบแบบ End-to-End, การตรวจสอบความเสถียรของโค้ด และการแก้ปัญหา SPA Client-side Routing HTTP 404"),
        ("7. นายกฤษณะ อุปถัมภ์", "693380289-6", "Field Research & User Interviewer Lead",
         "รับผิดชอบการวางแผนและดำเนินกิจกรรมเก็บข้อมูลภาคสนามกับกลุ่มตัวอย่าง 110 รายใน 16 คณะวิชา มหาวิทยาลัยขอนแก่น และการรวบรวมแบบประเมิน"),
        ("8. นายพุฒิเมธ เตโช", "693380083-6", "Documentation & Presentation Coordinator",
         "รับผิดชอบการประสานงานจัดทำรายงานวิชาการฉบับสมบูรณ์, การถอดบทเรียน Vibe Coding และการจัดทำสื่อนำเสนอ Pitch Deck")
    ]

    for b_name, b_id, b_role, b_desc in authors_bio:
        p_bio = doc.add_paragraph()
        p_bio.paragraph_format.space_before = Pt(4)
        p_bio.paragraph_format.space_after = Pt(4)
        p_bio.paragraph_format.line_spacing = 1.15
        run_name = p_bio.add_run(b_name + " ")
        run_name.bold = True
        run_name.font.color.rgb = RGBColor(0xEA, 0x58, 0x0C)
        p_bio.add_run(f"(รหัสนักศึกษา: {b_id})\n").bold = True
        p_bio.add_run(f"บทบาทหน้าที่: {b_role}\n").italic = True
        p_bio.add_run(f"ภาระงานสำคัญ: {b_desc}\n")

    # Save to Word Document
    output_filename = "QueueUp_Academic_Project_Report_Complete.docx"
    doc.save(output_filename)
    print(f"บันทึกไฟล์รายงาน Word ฉบับสมบูรณ์สำเร็จเรียบร้อย: {output_filename}")

    # Copy to docs/ directory as well
    docs_path = os.path.join("docs", output_filename)
    doc.save(docs_path)
    print(f"คัดลอกไฟล์รายงานไปยัง: {docs_path}")

if __name__ == "__main__":
    create_report()
