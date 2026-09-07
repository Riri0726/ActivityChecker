import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Export section gradebook to formatted Excel workbook (.xlsx).
 */
export async function exportSectionToExcel({
  sectionName,
  subjectCode = '',
  students = [],
  activities = [],
  scores = [],
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Activity Checker';
  workbook.created = new Date();

  const sheetName = (sectionName || 'Gradebook').slice(0, 31).replace(/[:\\/?*[\]]/g, '_');
  const sheet = workbook.addWorksheet(sheetName);

  // Identity columns
  const columns = [
    { header: 'Surname', key: 'surname', width: 18 },
    { header: 'First Name', key: 'firstName', width: 18 },
    { header: 'Student No.', key: 'studentNo', width: 15 },
  ];

  // Activity columns
  activities.forEach((act, idx) => {
    columns.push({
      header: `${act.title} [${act.max_score || 0}]`,
      key: `act_${act.id}`,
      width: Math.max(14, act.title.length + 6),
    });
  });

  // Summary columns
  columns.push(
    { header: 'Total Score', key: 'total_score', width: 14 },
    { header: 'Percentage (%)', key: 'percentage', width: 16 }
  );

  sheet.columns = columns;

  // Header styling
  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: colNumber <= 3 ? 'FF2D3A8C' : colNumber > columns.length - 2 ? 'FF1E293B' : 'FF0F766E',
      },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } } };
  });

  // Data rows
  const scoreMap = {};
  scores.forEach((s) => {
    scoreMap[`${s.student_id}_${s.activity_id}`] = s;
  });

  const totalMax = activities.reduce((sum, a) => sum + (parseFloat(a.max_score) || 0), 0);

  students.forEach((student, idx) => {
    const rowData = {
      surname: student.surname,
      firstName: student.first_name,
      studentNo: student.student_no || '',
    };

    let studentTotal = 0;
    activities.forEach((act) => {
      const sc = scoreMap[`${student.id}_${act.id}`];
      if (sc && sc.status === 'done' && sc.score !== null) {
        rowData[`act_${act.id}`] = sc.score;
        studentTotal += sc.score;
      } else {
        rowData[`act_${act.id}`] = 'MISSING';
      }
    });

    rowData.total_score = studentTotal;
    rowData.percentage = totalMax > 0 ? `${Math.round((studentTotal / totalMax) * 100)}%` : '—';

    const row = sheet.addRow(rowData);
    row.height = 22;

    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }

    row.eachCell((cell, colNumber) => {
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber <= 2 ? 'left' : 'center',
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (cell.value === 'MISSING') {
        cell.font = { color: { argb: 'FFDC2626' }, italic: true, size: 9 };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const filename = `${subjectCode ? subjectCode + '_' : ''}${sectionName}_Gradebook_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export section gradebook to styled PDF document (.pdf).
 */
export async function exportSectionToPdf({
  sectionName,
  subjectCode = '',
  teacherName = '',
  students = [],
  activities = [],
  scores = [],
}) {
  // Use landscape for gradebook tables
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });

  // Title Header
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('ACTIVITY TRACKER — SECTION GRADEBOOK REPORT', 40, 40);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Section: ${sectionName}  ${subjectCode ? `| Course: ${subjectCode}` : ''}  ${teacherName ? `| Instructor: ${teacherName}` : ''}`, 40, 58);
  doc.text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 40, 72);

  // Table Columns
  const tableHeaders = ['#', 'Surname', 'First Name', 'Student No.'];
  activities.forEach((act) => {
    tableHeaders.push(`${act.title}\n[${act.max_score || 0}]`);
  });
  tableHeaders.push('Total', '%');

  // Table Rows
  const scoreMap = {};
  scores.forEach((s) => {
    scoreMap[`${s.student_id}_${s.activity_id}`] = s;
  });

  const totalMax = activities.reduce((sum, a) => sum + (parseFloat(a.max_score) || 0), 0);

  const tableData = students.map((student, idx) => {
    const row = [
      idx + 1,
      student.surname,
      student.first_name,
      student.student_no || '—',
    ];

    let studentTotal = 0;
    activities.forEach((act) => {
      const sc = scoreMap[`${student.id}_${act.id}`];
      if (sc && sc.status === 'done' && sc.score !== null) {
        row.push(sc.score);
        studentTotal += sc.score;
      } else {
        row.push('MISSING');
      }
    });

    row.push(studentTotal);
    row.push(totalMax > 0 ? `${Math.round((studentTotal / totalMax) * 100)}%` : '—');
    return row;
  });

  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: 85,
    margin: { left: 40, right: 40 },
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4,
      valign: 'middle',
      halign: 'center',
    },
    headStyles: {
      fillColor: [45, 58, 140],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 24 },
      1: { halign: 'left', fontStyle: 'bold' },
      2: { halign: 'left' },
      3: { halign: 'center' },
    },
    didParseCell: (hookData) => {
      if (hookData.cell.raw === 'MISSING') {
        hookData.cell.styles.textColor = [220, 38, 38];
        hookData.cell.styles.fontStyle = 'italic';
      }
    },
  });

  const filename = `${subjectCode ? subjectCode + '_' : ''}${sectionName}_Gradebook_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
