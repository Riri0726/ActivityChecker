import ExcelJS from 'exceljs';
import { deriveAccessKey } from './studentService.js';

/**
 * Parse an Excel workbook (.xlsx) uploaded by the admin.
 *
 * Expected sheet structure per tab:
 *   Tab name       = section name (e.g., "BSIT-3A")
 *   Row 1 headers  = [Surname, First Name, Student No., "Act 1 [50]", "Act 2 [30]", ...]
 *   Rows 2+        = student data
 *
 * Returns:
 *   Array of { sectionName, students[], activities[], scores[], duplicates[] }
 */
export async function parseWorkbook(file) {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const results = [];

  workbook.eachSheet((worksheet, sheetId) => {
    const sectionName = worksheet.name.trim();
    if (!sectionName) return;

    // Read all rows as arrays
    const rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      rows.push(row.values.slice(1)); // row.values is 1-indexed; slice(1) makes it 0-indexed
    });

    if (rows.length < 2) return; // need at least header + 1 student

    const headerRow = rows[0].map((h) => (h ? String(h).trim() : ''));

    // Identify identity column indices (case-insensitive)
    const surnameIdx    = headerRow.findIndex((h) => /^surname$/i.test(h));
    const firstNameIdx  = headerRow.findIndex((h) => /^first.?name$/i.test(h));
    const studentNoIdx  = headerRow.findIndex((h) => /^student.?no\.?$/i.test(h));

    if (surnameIdx === -1 || firstNameIdx === -1) {
      console.warn(`Sheet "${sectionName}" missing Surname or First Name column — skipped.`);
      return;
    }

    // Identity columns occupy indices up to max(surnameIdx, firstNameIdx, studentNoIdx)
    const lastIdentityIdx = Math.max(surnameIdx, firstNameIdx, studentNoIdx === -1 ? 0 : studentNoIdx);

    // Parse activity columns (everything after the last identity column)
    const activities = [];
    for (let i = lastIdentityIdx + 1; i < headerRow.length; i++) {
      const header = headerRow[i];
      if (!header) continue;

      // Parse "Title [MaxScore]" format
      const match = header.match(/^(.+?)\s*\[(\d+(?:\.\d+)?)\]\s*$/);
      const title    = match ? match[1].trim() : header;
      const maxScore = match ? parseFloat(match[2]) : 0;

      activities.push({ title, maxScore, orderIndex: i - lastIdentityIdx - 1, colIndex: i });
    }

    // Parse student rows
    const students = [];
    const scores   = [];
    const accessKeysSeen = new Map(); // accessKey -> rowNumber
    const duplicates = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const surname   = row[surnameIdx]   ? String(row[surnameIdx]).trim()   : '';
      const firstName = row[firstNameIdx] ? String(row[firstNameIdx]).trim() : '';
      const studentNo = (studentNoIdx !== -1 && row[studentNoIdx])
        ? String(row[studentNoIdx]).trim()
        : null;

      if (!surname && !firstName) continue; // skip truly empty rows

      const accessKey = deriveAccessKey(surname, studentNo);

      // Duplicate credential check
      if (accessKeysSeen.has(accessKey)) {
        duplicates.push({
          row: r + 1,
          conflictsWith: accessKeysSeen.get(accessKey) + 1,
          surname,
          firstName,
          studentNo,
          accessKey,
        });
      } else {
        accessKeysSeen.set(accessKey, r);
      }

      students.push({ surname, firstName, studentNo, accessKey });

      // Parse scores for this student
      const studentScores = [];
      for (const act of activities) {
        const cellVal = row[act.colIndex];
        const isBlank = cellVal === null || cellVal === undefined || cellVal === '';
        const score   = isBlank ? null : parseFloat(String(cellVal));

        studentScores.push({
          activityTitle: act.title,
          score:  isBlank ? null : (isNaN(score) ? null : score),
          status: isBlank ? 'missing' : 'done',
        });
      }
      scores.push({ accessKey, studentScores });
    }

    results.push({ sectionName, students, activities, scores, duplicates });
  });

  return results;
}
