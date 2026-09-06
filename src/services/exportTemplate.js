import ExcelJS from 'exceljs';

/**
 * Downloads a sample Excel template with the correct format
 * for the teacher to fill in and upload.
 *
 * Format per sheet tab:
 *   Surname | First Name | Student No. | Activity Name [MaxScore] | ...
 */
export async function downloadGradebookTemplate(sectionName = 'BSIT-3A') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Activity Checker';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sectionName);

  // ── Column definitions ────────────────────────────────────────
  const identityCols = [
    { header: 'Surname',     key: 'surname',    width: 18 },
    { header: 'First Name',  key: 'firstName',  width: 18 },
    { header: 'Student No.', key: 'studentNo',  width: 14 },
  ];

  const sampleActivities = [
    { header: 'Quiz 1 [25]',       key: 'q1',  width: 14 },
    { header: 'Seatwork 1 [50]',   key: 'sw1', width: 16 },
    { header: 'Long Test 1 [100]', key: 'lt1', width: 18 },
    { header: 'Project 1 [100]',   key: 'pr1', width: 16 },
  ];

  sheet.columns = [...identityCols, ...sampleActivities];

  // ── Header row styling ────────────────────────────────────────
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colNumber <= 3 ? 'FF2D3A8C' : 'FF1E7E34' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
    };
  });
  headerRow.height = 30;

  // ── Sample student rows ───────────────────────────────────────
  const sampleStudents = [
    { surname: 'DELA CRUZ', firstName: 'Juan',     studentNo: '212301', q1: 22,  sw1: 45, lt1: 88, pr1: 92 },
    { surname: 'GARCIA',    firstName: 'Maria',    studentNo: '212302', q1: 20,  sw1: 48, lt1: 91, pr1: 88 },
    { surname: 'SANTOS',    firstName: 'Jose',     studentNo: '212303', q1: '',  sw1: '', lt1: 75, pr1: 80 },
    { surname: 'REYES',     firstName: 'Ana',      studentNo: '',       q1: 18,  sw1: 42, lt1: 82, pr1: '' },
    { surname: 'LOPEZ',     firstName: 'Carlos',   studentNo: '212305', q1: 25,  sw1: 50, lt1: 95, pr1: 98 },
  ];

  sampleStudents.forEach((student, idx) => {
    const row = sheet.addRow(student);
    // Shade alternating rows
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
      });
    }
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
    });
    row.height = 22;
  });

  // ── Instructions sheet ────────────────────────────────────────
  const instrSheet = workbook.addWorksheet('📋 Instructions');
  instrSheet.columns = [{ width: 80 }];

  const instructions = [
    ['ACTIVITY CHECKER — GRADEBOOK TEMPLATE INSTRUCTIONS'],
    [''],
    ['HOW TO USE THIS TEMPLATE:'],
    [''],
    ['1. SHEET TAB NAME = Section Name'],
    ['   • Rename the tab (currently "' + sectionName + '") to your actual section name'],
    ['   • Example: BSIT-3A, ABM-11B, STEM-12A'],
    ['   • Each section must be a separate tab in the same workbook'],
    [''],
    ['2. REQUIRED IDENTITY COLUMNS (must be in this order, first 3 columns):'],
    ['   • Surname       — Student\'s last name (ALL CAPS recommended)'],
    ['   • First Name    — Student\'s given name'],
    ['   • Student No.   — Optional. Leave BLANK if student has no number.'],
    ['     ⚠ If two students share the same surname AND both have no student number,'],
    ['       the system will warn you about a login collision. Add a student number to fix.'],
    [''],
    ['3. ACTIVITY COLUMNS (everything after the 3 identity columns):'],
    ['   • Column header format: Activity Name [MaxScore]'],
    ['   • Example: "Quiz 1 [25]" or "Long Test 1 [100]" or "Project 1 [50]"'],
    ['   • The [MaxScore] in brackets is required for percentage calculation'],
    ['   • You can add as many activity columns as you need'],
    ['   • The order of columns = the order shown on the student dashboard'],
    [''],
    ['4. SCORE VALUES:'],
    ['   • Numeric value = student\'s score (e.g. 45, 38.5)'],
    ['   • 0 (zero) = student submitted but scored zero (treated as DONE)'],
    ['   • Blank/empty = student has not submitted (treated as MISSING ⚠)'],
    [''],
    ['5. RE-UPLOADING:'],
    ['   • You can re-upload at any time to update scores'],
    ['   • Re-upload always overwrites existing scores'],
    ['   • Activities removed from the sheet will be ARCHIVED (not deleted)'],
    ['   • Student history and appeals are never deleted'],
    [''],
    ['STUDENT LOGIN CREDENTIALS (auto-generated from this sheet):'],
    ['   • With Student No.:  Surname + StudentNo  (e.g. "DELACRUZ212301")'],
    ['   • Without Student No.: Surname only (e.g. "GARCIA")'],
    ['   • Section field: the tab name (e.g. "BSIT-3A")'],
    ['   • All matching is case-insensitive'],
  ];

  instructions.forEach(([text], i) => {
    const row = instrSheet.addRow([text]);
    const cell = row.getCell(1);

    if (i === 0) {
      cell.font = { bold: true, size: 13, color: { argb: 'FF2D3A8C' } };
    } else if (text?.startsWith('HOW TO') || text?.startsWith('STUDENT LOGIN')) {
      cell.font = { bold: true, size: 11, color: { argb: 'FF1E7E34' } };
    } else if (text?.match(/^\d\./)) {
      cell.font = { bold: true, size: 10 };
    } else {
      cell.font = { size: 10 };
    }
    row.height = 18;
  });

  // ── Generate and download ─────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ActivityChecker_Template_${sectionName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
