import * as XLSX from 'xlsx';
import { ExcelPreviewData, ExcelValidationError } from '../types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Service for School Ingestion:
 * - Generates & downloads standard QueueUp_School_Template.xlsx
 * - Parses and rigorously validates uploaded .xlsx / .xls files
 */
export const ExcelService = {
  /**
   * สร้างและดาวน์โหลดไฟล์แม่แบบ QueueUp_School_Template.xlsx (3 Sheets: SCHOOL, ADMINS, USERS)
   */
  downloadTemplate(): void {
    const wb = XLSX.utils.book_new();

    // 1. Sheet: SCHOOL
    const schoolHeaders = [
      ['schoolCode', 'schoolName', 'province', 'contactEmail', 'contactPhone', 'emailDomain'],
      ['SCH001', 'โรงเรียนตัวอย่างวิทยาคม', 'ขอนแก่น', 'contact@example.ac.th', '043-123456', 'example.ac.th']
    ];
    const wsSchool = XLSX.utils.aoa_to_sheet(schoolHeaders);
    XLSX.utils.book_append_sheet(wb, wsSchool, 'SCHOOL');

    // 2. Sheet: ADMINS (Sheet-Driven Role: All rows automatically assigned role = 'admin')
    const adminHeaders = [
      ['admin_id', 'full_name', 'email', 'phone'],
      ['EMP001', 'อ.สมชาย ใจดี', 'somchai@example.ac.th', '0812345678'],
      ['EMP002', 'อ.สมหญิง สดใส', 'somying@example.ac.th', '0898765432']
    ];
    const wsAdmins = XLSX.utils.aoa_to_sheet(adminHeaders);
    XLSX.utils.book_append_sheet(wb, wsAdmins, 'ADMINS');

    // 3. Sheet: USERS (Sheet-Driven Role: All rows automatically assigned role = 'student')
    const userHeaders = [
      ['member_id', 'full_name', 'email', 'phone', 'room_grade'],
      ['65001', 'นายกิตติคุณ มีสุข', 'student01@example.ac.th', '0811111111', 'ม.4/1'],
      ['65002', 'นางสาวพิมพ์ใจ รักเรียน', 'student02@example.ac.th', '0822222222', 'ม.4/1'],
      ['65003', 'เด็กชายธนากร เก่งกาจ', 'student03@example.ac.th', '0833333333', 'ม.4/2']
    ];
    const wsUsers = XLSX.utils.aoa_to_sheet(userHeaders);
    XLSX.utils.book_append_sheet(wb, wsUsers, 'USERS');

    // Export file
    XLSX.writeFile(wb, 'QueueUp_School_Template.xlsx');
  },

  /**
   * อ่านไฟล์ Excel และตรวจสอบความถูกต้อง (Validation Engine)
   */
  async parseAndValidate(file: File): Promise<ExcelPreviewData> {
    const errors: ExcelValidationError[] = [];

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    // 1. ตรวจสอบ Sheet ครบทั้ง 3 Sheet หรือไม่
    const sheetNames = wb.SheetNames;
    const requiredSheets = ['SCHOOL', 'ADMINS', 'USERS'];
    const missingSheets = requiredSheets.filter(s => !sheetNames.includes(s));

    if (missingSheets.length > 0) {
      errors.push({
        sheetName: 'WORKBOOK',
        rowNumber: 0,
        field: 'SheetNames',
        message: `ไฟล์ขาด Sheet ที่จำเป็น: ${missingSheets.join(', ')} (ต้องมี SCHOOL, ADMINS, USERS ครบถ้วน)`
      });

      return {
        schoolCount: 0,
        adminCount: 0,
        studentCount: 0,
        admins: [],
        students: [],
        errors,
        isValid: false
      };
    }

    // 2. Parse & Validate Sheet: SCHOOL
    const wsSchool = wb.Sheets['SCHOOL'];
    const schoolRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wsSchool, { defval: '' });
    let schoolInfo: ExcelPreviewData['schoolInfo'] = undefined;

    if (schoolRows.length === 0) {
      errors.push({
        sheetName: 'SCHOOL',
        rowNumber: 2,
        field: 'Rows',
        message: 'ไม่พบข้อมูลสถานศึกษาใน Sheet SCHOOL'
      });
    } else {
      const firstSchool = schoolRows[0];
      const schoolCode = String(firstSchool['schoolCode'] || '').trim();
      const schoolName = String(firstSchool['schoolName'] || '').trim();
      const province = String(firstSchool['province'] || '').trim();
      const contactEmail = String(firstSchool['contactEmail'] || '').trim();
      const contactPhone = String(firstSchool['contactPhone'] || '').trim();
      const emailDomain = String(firstSchool['emailDomain'] || '').trim();

      if (!schoolCode) errors.push({ sheetName: 'SCHOOL', rowNumber: 2, field: 'schoolCode', message: 'รหัสสถานศึกษา (schoolCode) ต้องไม่ว่าง' });
      if (!schoolName) errors.push({ sheetName: 'SCHOOL', rowNumber: 2, field: 'schoolName', message: 'ชื่อสถานศึกษา (schoolName) ต้องไม่ว่าง' });
      if (!province) errors.push({ sheetName: 'SCHOOL', rowNumber: 2, field: 'province', message: 'จังหวัด (province) ต้องไม่ว่าง' });
      if (!contactEmail) {
        errors.push({ sheetName: 'SCHOOL', rowNumber: 2, field: 'contactEmail', message: 'อีเมลติดต่อ (contactEmail) ต้องไม่ว่าง' });
      } else if (!EMAIL_REGEX.test(contactEmail)) {
        errors.push({ sheetName: 'SCHOOL', rowNumber: 2, field: 'contactEmail', message: `รูปแบบอีเมลติดต่อไม่ถูกต้อง: "${contactEmail}"` });
      }

      schoolInfo = {
        schoolCode,
        schoolName,
        province,
        contactEmail,
        contactPhone,
        emailDomain
      };
    }

    // 3. Parse & Validate Sheet: ADMINS
    const wsAdmins = wb.Sheets['ADMINS'];
    const adminRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wsAdmins, { defval: '' });
    const parsedAdmins: ExcelPreviewData['admins'] = [];
    const seenAdminIds = new Set<string>();
    const seenEmails = new Set<string>();

    adminRows.forEach((row, idx) => {
      const rowNum = idx + 2; // header is row 1
      const employeeId = String(row['admin_id'] || row['employeeId'] || '').trim();
      const fullName = String(row['full_name'] || row['fullName'] || '').trim();
      const position = String(row['position'] || 'ผู้ดูแลระบบ').trim();
      const email = String(row['email'] || '').trim().toLowerCase();
      const phone = String(row['phone'] || '').trim();

      if (!employeeId && !fullName && !email) {
        // Skip purely blank row
        return;
      }

      if (!employeeId) errors.push({ sheetName: 'ADMINS', rowNumber: rowNum, field: 'admin_id', message: 'รหัสบุคลากร (admin_id) ต้องไม่ว่าง' });
      if (!fullName) errors.push({ sheetName: 'ADMINS', rowNumber: rowNum, field: 'full_name', message: 'ชื่อ-นามสกุล (full_name) ต้องไม่ว่าง' });
      if (!email) {
        errors.push({ sheetName: 'ADMINS', rowNumber: rowNum, field: 'email', message: 'อีเมล (email) ต้องไม่ว่าง' });
      } else if (!EMAIL_REGEX.test(email)) {
        errors.push({ sheetName: 'ADMINS', rowNumber: rowNum, field: 'email', message: `รูปแบบอีเมลไม่ถูกต้อง: "${email}"` });
      }

      // Check duplicates
      if (employeeId) {
        if (seenAdminIds.has(employeeId)) {
          errors.push({ sheetName: 'ADMINS', rowNumber: rowNum, field: 'admin_id', message: `รหัสบุคลากรซ้ำ: "${employeeId}"` });
        } else {
          seenAdminIds.add(employeeId);
        }
      }

      if (email) {
        if (seenEmails.has(email)) {
          errors.push({ sheetName: 'ADMINS', rowNumber: rowNum, field: 'email', message: `อีเมลซ้ำกับรายการอื่น: "${email}"` });
        } else {
          seenEmails.add(email);
        }
      }

      parsedAdmins.push({ employeeId, fullName, position, email, phone });
    });

    if (parsedAdmins.length === 0) {
      errors.push({ sheetName: 'ADMINS', rowNumber: 2, field: 'Rows', message: 'ต้องมีรายชื่อ Admin อย่างน้อย 1 ท่านใน Sheet ADMINS' });
    }

    // 4. Parse & Validate Sheet: USERS (Sheet-Driven Role -> student)
    const wsUsers = wb.Sheets['USERS'];
    const userRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wsUsers, { defval: '' });
    const parsedStudents: ExcelPreviewData['students'] = [];
    const seenStudentIds = new Set<string>();

    userRows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const studentId = String(row['member_id'] || row['studentId'] || '').trim();
      const fullName = String(row['full_name'] || row['fullName'] || '').trim();
      const email = String(row['email'] || '').trim().toLowerCase();
      const phone = String(row['phone'] || '').trim();
      const classRoom = String(row['room_grade'] || row['classRoom'] || '').trim();

      if (!studentId && !fullName && !email) {
        // Skip empty row
        return;
      }

      if (!studentId) errors.push({ sheetName: 'USERS', rowNumber: rowNum, field: 'member_id', message: 'รหัสนักเรียน (member_id) ต้องไม่ว่าง' });
      if (!fullName) errors.push({ sheetName: 'USERS', rowNumber: rowNum, field: 'full_name', message: 'ชื่อ-นามสกุล (full_name) ต้องไม่ว่าง' });
      if (!email) {
        errors.push({ sheetName: 'USERS', rowNumber: rowNum, field: 'email', message: 'อีเมล (email) ต้องไม่ว่าง' });
      } else if (!EMAIL_REGEX.test(email)) {
        errors.push({ sheetName: 'USERS', rowNumber: rowNum, field: 'email', message: `รูปแบบอีเมลไม่ถูกต้อง: "${email}"` });
      }

      if (studentId) {
        if (seenStudentIds.has(studentId)) {
          errors.push({ sheetName: 'USERS', rowNumber: rowNum, field: 'member_id', message: `รหัสนักเรียนซ้ำ: "${studentId}"` });
        } else {
          seenStudentIds.add(studentId);
        }
      }

      if (email) {
        if (seenEmails.has(email)) {
          errors.push({ sheetName: 'USERS', rowNumber: rowNum, field: 'email', message: `อีเมลซ้ำกับรายการอื่น: "${email}"` });
        } else {
          seenEmails.add(email);
        }
      }

      parsedStudents.push({ studentId, fullName, email, phone, classRoom });
    });

    if (parsedStudents.length === 0) {
      errors.push({ sheetName: 'USERS', rowNumber: 2, field: 'Rows', message: 'ต้องมีรายชื่อนักเรียน/สมาชิกอย่างน้อย 1 คนใน Sheet USERS' });
    }

    return {
      schoolCount: schoolInfo ? 1 : 0,
      adminCount: parsedAdmins.length,
      studentCount: parsedStudents.length,
      schoolInfo,
      admins: parsedAdmins,
      students: parsedStudents,
      errors,
      isValid: errors.length === 0
    };
  }
};
