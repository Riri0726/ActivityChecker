import { supabase } from './supabase.js';

// ============================================================
// SECTION MANAGEMENT
// ============================================================

export async function upsertSection(name) {
  const { data, error } = await supabase
    .from('sections')
    .upsert({ name: name.trim() }, { onConflict: 'name', ignoreDuplicates: false })
    .select('id, name')
    .single();

  if (error) throw new Error(`Failed to upsert section "${name}": ${error.message}`);
  return data;
}

// ============================================================
// STUDENT MANAGEMENT
// ============================================================

export async function upsertStudent(sectionId, { surname, firstName, studentNo, accessKey }) {
  const { data, error } = await supabase
    .from('students')
    .upsert(
      {
        section_id: sectionId,
        surname: surname.trim(),
        first_name: firstName.trim(),
        student_no: studentNo || null,
        access_key: accessKey,
      },
      { onConflict: 'section_id,access_key', ignoreDuplicates: false }
    )
    .select('id')
    .single();

  if (error) throw new Error(`Failed to upsert student "${accessKey}": ${error.message}`);
  return data;
}

// ============================================================
// ACTIVITY MANAGEMENT
// ============================================================

export async function upsertActivity(sectionId, { title, maxScore, orderIndex }) {
  const { data, error } = await supabase
    .from('activities')
    .upsert(
      {
        section_id: sectionId,
        title: title.trim(),
        max_score: maxScore,
        order_index: orderIndex,
        archived: false,
      },
      { onConflict: 'section_id,title', ignoreDuplicates: false }
    )
    .select('id, title')
    .single();

  if (error) throw new Error(`Failed to upsert activity "${title}": ${error.message}`);
  return data;
}

/**
 * Mark activities that are in the DB for this section
 * but NOT in the re-uploaded sheet as archived (soft-delete).
 */
export async function archiveRemovedActivities(sectionId, uploadedTitles) {
  const { data: existing } = await supabase
    .from('activities')
    .select('id, title')
    .eq('section_id', sectionId)
    .eq('archived', false);

  if (!existing || existing.length === 0) return;

  const uploadedSet = new Set(uploadedTitles.map((t) => t.trim().toLowerCase()));
  const toArchive = existing.filter((a) => !uploadedSet.has(a.title.trim().toLowerCase()));

  if (toArchive.length === 0) return;

  const ids = toArchive.map((a) => a.id);
  const { error } = await supabase
    .from('activities')
    .update({ archived: true })
    .in('id', ids);

  if (error) throw new Error(`Failed to archive removed activities: ${error.message}`);
  return toArchive; // return list of archived activities for UI feedback
}

// ============================================================
// SCORE MANAGEMENT
// ============================================================

export async function upsertScore(studentId, activityId, score, status) {
  const { error } = await supabase
    .from('scores')
    .upsert(
      {
        student_id: studentId,
        activity_id: activityId,
        score: score,
        status: status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id,activity_id', ignoreDuplicates: false }
    );

  if (error) throw new Error(`Failed to upsert score: ${error.message}`);
}

/**
 * Directly update a single score from the in-app gradebook.
 * Re-upload will overwrite this later if the sheet changes.
 */
export async function updateScoreInline(scoreId, newScore) {
  const isBlank = newScore === null || newScore === undefined || newScore === '';
  const score  = isBlank ? null : parseFloat(newScore);
  const status = isBlank ? 'missing' : 'done';

  const { error } = await supabase
    .from('scores')
    .update({ score, status, updated_at: new Date().toISOString() })
    .eq('id', scoreId);

  if (error) throw new Error(`Failed to update score: ${error.message}`);
}

// ============================================================
// FULL WORKBOOK IMPORT (orchestrates all the above)
// ============================================================

/**
 * Import a parsed workbook result array into Supabase.
 * Called after parseWorkbook() returns data.
 * Returns a summary of what was created/updated, plus any warnings.
 */
export async function importParsedWorkbook(parsedSheets) {
  const importSummary = [];

  for (const sheet of parsedSheets) {
    const { sectionName, students, activities, scores, duplicates } = sheet;

    // 1. Upsert section
    const section = await upsertSection(sectionName);

    // 2. Upsert activities + build title→id map
    const activityMap = {}; // title → { id, maxScore }
    for (const act of activities) {
      const saved = await upsertActivity(section.id, act);
      activityMap[act.title] = { id: saved.id, maxScore: act.maxScore };
    }

    // 3. Soft-delete activities removed from the sheet
    const uploadedTitles = activities.map((a) => a.title);
    const archivedActivities = await archiveRemovedActivities(section.id, uploadedTitles);

    // 4. Upsert students + scores
    let studentsProcessed = 0;
    for (let i = 0; i < students.length; i++) {
      const studentData = students[i];
      const saved = await upsertStudent(section.id, studentData);
      studentsProcessed++;

      // Upsert scores for this student
      const studentScores = scores[i]?.studentScores || [];
      for (const s of studentScores) {
        const act = activityMap[s.activityTitle];
        if (!act) continue;
        await upsertScore(saved.id, act.id, s.score, s.status);
      }
    }

    importSummary.push({
      sectionName,
      studentsProcessed,
      activitiesProcessed: activities.length,
      archivedCount: archivedActivities?.length || 0,
      duplicates,
    });
  }

  return importSummary;
}

// ============================================================
// APPEALS MANAGEMENT (admin)
// ============================================================

export async function getAppeals(filters = {}) {
  let query = supabase
    .from('appeals')
    .select(`
      id, reason, notes, status, instructor_remarks, created_at,
      students ( id, surname, first_name, student_no, section_id,
        sections ( name )
      ),
      activities ( id, title, max_score )
    `)
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.sectionId) {
    query = query.eq('students.section_id', filters.sectionId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load appeals: ${error.message}`);
  return data;
}

export async function updateAppeal(appealId, { status, instructorRemarks }) {
  const { error } = await supabase
    .from('appeals')
    .update({ status, instructor_remarks: instructorRemarks || null })
    .eq('id', appealId);

  if (error) throw new Error(`Failed to update appeal: ${error.message}`);
}

// ============================================================
// MAKEUP REQUESTS MANAGEMENT (admin)
// ============================================================

export async function getMakeupRequests(filters = {}) {
  let query = supabase
    .from('makeup_requests')
    .select(`
      id, student_notes, status, created_at,
      students ( id, surname, first_name, student_no, section_id,
        sections ( name )
      ),
      activities ( id, title )
    `)
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load makeup requests: ${error.message}`);
  return data;
}

export async function updateMakeupRequest(requestId, status) {
  const { error } = await supabase
    .from('makeup_requests')
    .update({ status })
    .eq('id', requestId);

  if (error) throw new Error(`Failed to update makeup request: ${error.message}`);
}

// ============================================================
// GRADEBOOK (admin read)
// ============================================================

export async function getGradebook(sectionId) {
  // Students
  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id, surname, first_name, student_no')
    .eq('section_id', sectionId)
    .order('surname');

  if (sErr) throw new Error(`Failed to load students: ${sErr.message}`);

  // Activities
  const { data: activities, error: aErr } = await supabase
    .from('activities')
    .select('id, title, max_score, order_index')
    .eq('section_id', sectionId)
    .eq('archived', false)
    .order('order_index');

  if (aErr) throw new Error(`Failed to load activities: ${aErr.message}`);

  // Scores for all students in this section
  const studentIds = students.map((s) => s.id);
  const { data: scores, error: scErr } = await supabase
    .from('scores')
    .select('id, student_id, activity_id, score, status')
    .in('student_id', studentIds);

  if (scErr) throw new Error(`Failed to load scores: ${scErr.message}`);

  return { students, activities, scores };
}

export async function getSections() {
  const { data, error } = await supabase
    .from('sections')
    .select('id, name')
    .eq('archived', false)
    .order('name');

  if (error) throw new Error(`Failed to load sections: ${error.message}`);
  return data;
}

// ============================================================
// NOTIFICATION COUNTS (admin badge)
// ============================================================

export async function getPendingCounts() {
  const [{ count: appeals }, { count: requests }] = await Promise.all([
    supabase.from('appeals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('makeup_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  return { pendingAppeals: appeals || 0, pendingRequests: requests || 0 };
}
