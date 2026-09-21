import ExcelJS from 'exceljs';
import { deriveAccessKey } from './studentService.js';

function extractCellValue(cellVal) {
  if (cellVal === null || cellVal === undefined) return null;
  if (typeof cellVal === 'number') return cellVal;
  if (typeof cellVal === 'string') return cellVal.trim();
  if (cellVal && cellVal.result !== undefined) return cellVal.result;
  if (cellVal && Array.isArray(cellVal.richText)) {
    return cellVal.richText.map(rt => rt.text).join('');
  }
  if (cellVal && cellVal.text !== undefined) return cellVal.text;
  return String(cellVal);
}

async function readFileBuffer(file) {
  if (file instanceof ArrayBuffer) return file;
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(file)) return file.buffer;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(file)) return file;
  if (typeof file?.arrayBuffer === 'function') {
    try {
      const buf = await file.arrayBuffer();
      if (buf && buf.byteLength > 0) return buf;
    } catch (e) {
      console.warn('file.arrayBuffer() failed, falling back to FileReader:', e);
    }
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(new Error('FileReader failed to read the file: ' + (e?.target?.error?.message || 'unknown error')));
      reader.readAsArrayBuffer(file);
    });
  }
  throw new Error('Unable to read file buffer: unsupported environment or file format.');
}

/**
 * Parse an Excel workbook (.xlsx) uploaded by the admin.
 *
 * Expected sheet structure per tab:
 *   Tab name       = section name (e.g., "BSIT-3A")
 *   Row 1 headers  = [Surname, First Name, Student No., "Act 1 [50]", "Act 2 [30]", ...]
 *   Rows 2+        = student data
 *
 * Returns:
 *   Array of { sectionName, students[], activities[], scores[], duplicates[], validation }
 *
 * validation = {
 *   errors:   string[]   — critical issues that should block import
 *   warnings: string[]   — non-critical issues the prof should fix
 *   info:     string[]   — informational notices
 *   hasMissingMaxScore:  boolean
 *   previewRows:         array of first 5 student rows for display
 * }
 */
export async function parseWorkbook(file) {
  try {
    const buffer = await readFileBuffer(file);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const results = [];

    // Check for skipped sheets (e.g., Instructions sheet)
    const SKIP_SHEET_NAMES = ['instructions', '📋 instructions', 'readme', 'notes', 'guide'];

    workbook.eachSheet((worksheet) => {
      const sectionName = worksheet.name.trim();
      if (!sectionName) return;

      // Skip instruction sheets
      if (SKIP_SHEET_NAMES.includes(sectionName.toLowerCase())) return;

      const errors   = [];
      const warnings = [];
      const info     = [];

      // Read all rows safely (ExcelJS can return Array or sparse Object for row.values)
      const rows = [];
      worksheet.eachRow({ includeEmpty: true }, (row) => {
        const rowVals = [];
        if (Array.isArray(row.values)) {
          for (let i = 1; i < row.values.length; i++) {
            rowVals.push(row.values[i]);
          }
        } else if (row.values && typeof row.values === 'object') {
          const keys = Object.keys(row.values).map(Number).filter((n) => !isNaN(n));
          const maxCol = keys.length > 0 ? Math.max(...keys) : 0;
          for (let i = 1; i <= maxCol; i++) {
            rowVals.push(row.values[i] !== undefined ? row.values[i] : null);
          }
        }
        rows.push(rowVals);
      });

      // Filter out completely empty rows for parsing
      const nonEmptyRows = rows.filter((r) => r.some((c) => c !== null && c !== undefined && c !== ''));

      if (nonEmptyRows.length < 2) {
        errors.push(`Sheet "${sectionName}" has no student data rows — only a header was found.`);
        results.push({ sectionName, students: [], activities: [], scores: [], duplicates: [], validation: { errors, warnings, info, hasMissingMaxScore: false, previewRows: [] } });
        return;
      }

      const headerRow = nonEmptyRows[0].map((h) => {
        const v = extractCellValue(h);
        return v ? String(v).trim() : '';
      });

      // ── Identity column detection ─────────────────────────────
      const surnameIdx   = headerRow.findIndex((h) => /^surname$/i.test(h));
      const firstNameIdx = headerRow.findIndex((h) => /^first.?name$/i.test(h));
      const studentNoIdx = headerRow.findIndex((h) => /^student.?no\.?$/i.test(h));

      if (surnameIdx === -1) errors.push('Missing required column: "Surname"');
      if (firstNameIdx === -1) errors.push('Missing required column: "First Name"');
      if (studentNoIdx === -1) warnings.push('"Student No." column not found — students without a student number will use surname-only login.');

      if (surnameIdx === -1 || firstNameIdx === -1) {
        results.push({ sectionName, students: [], activities: [], scores: [], duplicates: [], validation: { errors, warnings, info, hasMissingMaxScore: false, previewRows: [] } });
        return;
      }

      const lastIdentityIdx = Math.max(surnameIdx, firstNameIdx, studentNoIdx === -1 ? 0 : studentNoIdx);
      const activityColCount = headerRow.slice(lastIdentityIdx + 1).filter(Boolean).length;

      if (activityColCount === 0) {
        errors.push('No activity columns found after the identity columns. Add columns like "Quiz 1 [50]".');
      }

      // ── Activity column validation ────────────────────────────
      const activities = [];
      let hasMissingMaxScore = false;

      for (let i = lastIdentityIdx + 1; i < headerRow.length; i++) {
        const header = headerRow[i];
        if (!header) continue;

        const match = header.match(/^(.+?)\s*\[(\d+(?:\.\d+)?)\]\s*$/);
        const title    = match ? match[1].trim() : header;
        const maxScore = match ? parseFloat(match[2]) : 0;

        if (!match) {
          hasMissingMaxScore = true;
          warnings.push(`Column "${header}" is missing [MaxScore]. Rename it to "${header} [50]" (or your actual max). Score percentage will show as 0%.`);
        }

        activities.push({ title, maxScore, orderIndex: i - lastIdentityIdx - 1, colIndex: i, hasMaxScore: !!match, rawHeader: header });
      }

      // ── Student row parsing ───────────────────────────────────
      const students   = [];
      const scores     = [];
      const accessKeysSeen = new Map();
      const duplicates = [];
      let invalidScoreCount = 0;
      let missingScoreCount = 0;

      for (let r = 1; r < nonEmptyRows.length; r++) {
        const row = nonEmptyRows[r];
        
        const rawSurname = extractCellValue(row[surnameIdx]);
        const surname = rawSurname ? String(rawSurname).trim() : '';
        
        const rawFirstName = extractCellValue(row[firstNameIdx]);
        const firstName = rawFirstName ? String(rawFirstName).trim() : '';
        
        const rawStudentNo = studentNoIdx !== -1 ? extractCellValue(row[studentNoIdx]) : null;
        const studentNo = rawStudentNo ? String(rawStudentNo).trim() : null;

        if (!surname && !firstName) continue;

        const accessKey = deriveAccessKey(surname, studentNo);

        if (accessKeysSeen.has(accessKey)) {
          duplicates.push({
            row: r + 1,
            conflictsWith: accessKeysSeen.get(accessKey) + 1,
            surname, firstName, studentNo, accessKey,
          });
        } else {
          accessKeysSeen.set(accessKey, r);
        }

        students.push({ surname, firstName, studentNo, accessKey });

        const studentScores = [];
        const MISSING_KEYWORDS = ['missing', 'n/a', 'na', '-', '--', 'none', 'absent', 'inc', 'inc.', 'null', 'undefined'];

        for (const act of activities) {
          const cellVal = extractCellValue(row[act.colIndex]);
          const rawStr = cellVal !== null && cellVal !== undefined ? String(cellVal).trim() : '';
          const isExplicitlyMissing = MISSING_KEYWORDS.includes(rawStr.toLowerCase());
          const isBlank = rawStr === '' || isExplicitlyMissing;
          const numVal  = isBlank ? null : parseFloat(rawStr);
          const isNonNumeric = !isBlank && isNaN(numVal);
          const parsedScore = isBlank || isNaN(numVal) ? null : numVal;
          const status = parsedScore === null ? 'missing' : 'done';

          if (isNonNumeric) invalidScoreCount++;
          if (status === 'missing') missingScoreCount++;

          studentScores.push({
            activityTitle: act.title,
            score: parsedScore,
            status: status,
            isBlank: isBlank || parsedScore === null,
            isNonNumeric,
            rawValue: rawStr,
          });
        }
        scores.push({ accessKey, studentScores });
      }

      // ── Summary info messages ─────────────────────────────────
      info.push(`${students.length} student${students.length !== 1 ? 's' : ''} found`);
      info.push(`${activities.length} activit${activities.length !== 1 ? 'ies' : 'y'} found`);

      const missingPct = students.length > 0 && activities.length > 0
        ? Math.round((missingScoreCount / (students.length * activities.length)) * 100)
        : 0;
      info.push(`${missingScoreCount} missing score${missingScoreCount !== 1 ? 's' : ''} (${missingPct}% of total cells)`);

      if (invalidScoreCount > 0) {
        warnings.push(`${invalidScoreCount} cell${invalidScoreCount !== 1 ? 's' : ''} contain non-numeric values (not blank, not a number) — these will be treated as Missing.`);
      }
      if (duplicates.length > 0) {
        warnings.push(`${duplicates.length} duplicate login credential${duplicates.length !== 1 ? 's' : ''} detected — students may not be able to log in uniquely.`);
      }

      // ── Build preview rows (first 5 students) ─────────────────
      const previewRows = students.slice(0, 5).map((s, i) => ({
        ...s,
        scores: scores[i]?.studentScores ?? [],
      }));

      results.push({
        sectionName,
        students,
        activities,
        scores,
        duplicates,
        validation: { errors, warnings, info, hasMissingMaxScore, previewRows },
      });
    });

    return results;
  } catch (err) {
    throw new Error('Failed to parse the Excel file. ' + (err.message || 'The file may be corrupted or in an unsupported format.'));
  }
}
