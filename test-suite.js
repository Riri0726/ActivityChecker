import assert from 'node:assert';
import ExcelJS from 'exceljs';
import { parseWorkbook } from './src/services/excelParser.js';
import { deriveAccessKey } from './src/services/studentService.js';

console.log('🧪 Starting ActivityChecker Automated Test Suite...\n');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    testsFailed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    testsFailed++;
  }
}

// -------------------------------------------------------------
// Test 1: Access Key Generation & Name Normalization
// -------------------------------------------------------------
runTest('deriveAccessKey: Generates consistent normalized uppercase keys', () => {
  const key1 = deriveAccessKey('Casuncad', '2023-00001');
  const key2 = deriveAccessKey('CASUNCAD', '2023-00001');
  const key3 = deriveAccessKey('  casuncad  ', '  2023-00001  ');

  assert.strictEqual(key1, 'CASUNCAD2023-00001');
  assert.strictEqual(key2, 'CASUNCAD2023-00001');
  assert.strictEqual(key3, 'CASUNCAD2023-00001');
});

// -------------------------------------------------------------
// Test 2: Name Matching Deduplication Logic (Casuncad Scenario)
// -------------------------------------------------------------
runTest('Name Deduplication Logic: Matches student by surname + first name', () => {
  const existingDbStudents = [
    {
      id: 'student-123',
      section_id: 'sec-1',
      surname: 'Casuncad',
      first_name: 'Mark',
      student_no: '2023-00001',
      access_key: 'CASUNCAD2023-00001',
    },
    {
      id: 'student-456',
      section_id: 'sec-1',
      surname: 'Dela Cruz',
      first_name: 'Juan',
      student_no: '2023-00002',
      access_key: 'DELACRUZ2023-00002',
    },
  ];

  // Simulated re-upload where Casuncad student_no was updated from 2023-00001 to 2023-99999
  const incomingParsedStudent = {
    surname: 'CASUNCAD',
    firstName: 'MARK',
    studentNo: '2023-99999',
  };

  // Find match by name
  const match = existingDbStudents.find(
    s =>
      s.surname.trim().toUpperCase() === incomingParsedStudent.surname.trim().toUpperCase() &&
      s.first_name.trim().toUpperCase() === incomingParsedStudent.firstName.trim().toUpperCase()
  );

  assert.ok(match, 'Should have found existing student by name');
  assert.strictEqual(match.id, 'student-123', 'Should match existing record ID, preventing duplicate');

  // Generate updated access key
  const updatedAccessKey = deriveAccessKey(incomingParsedStudent.surname, incomingParsedStudent.studentNo);
  assert.strictEqual(updatedAccessKey, 'CASUNCAD2023-99999');
});

// -------------------------------------------------------------
// Test 3: Excel File Generation & Real Parsing with parseWorkbook
// -------------------------------------------------------------
await runAsyncTest('Excel Parser: Parses sections, activities [MaxScore], and score=0 vs missing', async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('BSIT 3A');

  // Setup headers: Surname | First Name | Student No | Quiz 1 [50] | Quiz 2 [100] | Activity 1 [30]
  ws.addRow(['Surname', 'First Name', 'Student No', 'Quiz 1 [50]', 'Quiz 2 [100]', 'Activity 1 [30]']);

  // Row 1: Casuncad - Score 0 on Quiz 1, blank on Quiz 2, 30 on Activity 1
  ws.addRow(['CASUNCAD', 'MARK', '2023-00001', 0, '', 30]);

  // Row 2: Dela Cruz - 45 on Quiz 1, 90 on Quiz 2, 0 on Activity 1
  ws.addRow(['DELA CRUZ', 'JUAN', '2023-00002', 45, 90, 0]);

  // Row 3: Santos - missing all scores
  ws.addRow(['SANTOS', 'MARIA', '2023-00003', null, undefined, '']);

  const buffer = await wb.xlsx.writeBuffer();
  const sheets = await parseWorkbook(buffer);

  assert.strictEqual(sheets.length, 1, 'Should have 1 sheet');
  const sheet = sheets[0];
  assert.strictEqual(sheet.sectionName, 'BSIT 3A');

  // Verify activities parsed
  assert.strictEqual(sheet.activities.length, 3);
  assert.strictEqual(sheet.activities[0].title, 'Quiz 1');
  assert.strictEqual(sheet.activities[0].maxScore, 50);
  assert.strictEqual(sheet.activities[1].title, 'Quiz 2');
  assert.strictEqual(sheet.activities[1].maxScore, 100);
  assert.strictEqual(sheet.activities[2].title, 'Activity 1');
  assert.strictEqual(sheet.activities[2].maxScore, 30);

  // Verify students parsed
  assert.strictEqual(sheet.students.length, 3);

  // Student 1 (Casuncad)
  const casuncad = sheet.students[0];
  assert.strictEqual(casuncad.surname, 'CASUNCAD');
  assert.strictEqual(casuncad.firstName, 'MARK');
  assert.strictEqual(casuncad.studentNo, '2023-00001');

  // Find scores in sheet.scores for Casuncad
  const casuncadScores = sheet.scores.find(s => s.accessKey === casuncad.accessKey)?.studentScores || [];
  const q1Score = casuncadScores.find(s => s.activityTitle === 'Quiz 1');
  const q2Score = casuncadScores.find(s => s.activityTitle === 'Quiz 2');
  const act1Score = casuncadScores.find(s => s.activityTitle === 'Activity 1');

  // CRITICAL TEST: Score 0 MUST be status: 'done' and score: 0
  assert.strictEqual(q1Score.score, 0);
  assert.strictEqual(q1Score.status, 'done', 'Score of 0 MUST have status "done"');

  // CRITICAL TEST: Blank cell MUST be status: 'missing' and score: null
  assert.strictEqual(q2Score.score, null);
  assert.strictEqual(q2Score.status, 'missing', 'Empty cell MUST have status "missing"');

  // Score 30
  assert.strictEqual(act1Score.score, 30);
  assert.strictEqual(act1Score.status, 'done');

  // Student 2 (Dela Cruz)
  const delaCruz = sheet.students[1];
  const delaCruzScores = sheet.scores.find(s => s.accessKey === delaCruz.accessKey)?.studentScores || [];
  const dcAct1 = delaCruzScores.find(s => s.activityTitle === 'Activity 1');
  assert.strictEqual(dcAct1.score, 0);
  assert.strictEqual(dcAct1.status, 'done');

  // Student 3 (Santos)
  const santos = sheet.students[2];
  const santosScores = sheet.scores.find(s => s.accessKey === santos.accessKey)?.studentScores || [];
  const santosQ1 = santosScores.find(s => s.activityTitle === 'Quiz 1');
  assert.strictEqual(santosQ1.status, 'missing');
  assert.strictEqual(santosQ1.score, null);
});

// -------------------------------------------------------------
// Test 4: Removed Students Detection in Diff Calculation
// -------------------------------------------------------------
runTest('Diff Calculation: Detects removed students when re-uploading modified sheet', () => {
  const existingDbStudents = [
    { id: '1', surname: 'Casuncad', firstName: 'Mark', studentNo: '2023-00001' },
    { id: '2', surname: 'Dela Cruz', firstName: 'Juan', studentNo: '2023-00002' },
    { id: '3', surname: 'RemovedStudent', firstName: 'Alice', studentNo: '2023-00003' },
  ];

  // New sheet contains Casuncad and Dela Cruz, but NOT RemovedStudent
  const parsedSheetStudents = [
    { surname: 'Casuncad', firstName: 'Mark', studentNo: '2023-00001' },
    { surname: 'Dela Cruz', firstName: 'Juan', studentNo: '2023-00002' },
    { surname: 'NewStudent', firstName: 'Bob', studentNo: '2023-00004' },
  ];

  // Detect removed students
  const removedStudents = existingDbStudents.filter(
    dbS => !parsedSheetStudents.some(
      pS => (pS.surname?.trim().toUpperCase() === dbS.surname?.trim().toUpperCase() &&
             pS.firstName?.trim().toUpperCase() === dbS.firstName?.trim().toUpperCase()) ||
            (pS.studentNo?.trim() === dbS.studentNo?.trim())
    )
  );

  // Detect new students
  const newStudents = parsedSheetStudents.filter(
    pS => !existingDbStudents.some(
      dbS => (pS.surname?.trim().toUpperCase() === dbS.surname?.trim().toUpperCase() &&
              pS.firstName?.trim().toUpperCase() === dbS.firstName?.trim().toUpperCase()) ||
             (pS.studentNo?.trim() === dbS.studentNo?.trim())
    )
  );

  assert.strictEqual(removedStudents.length, 1);
  assert.strictEqual(removedStudents[0].surname, 'RemovedStudent');

  assert.strictEqual(newStudents.length, 1);
  assert.strictEqual(newStudents[0].surname, 'NewStudent');
});

// -------------------------------------------------------------
// Test Summary
// -------------------------------------------------------------
console.log(`\n===========================================`);
console.log(`Test Results: ${testsPassed} Passed, ${testsFailed} Failed`);
console.log(`===========================================\n`);

if (testsFailed > 0) {
  process.exit(1);
}
