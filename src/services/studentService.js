import { supabase } from './supabase.js';

/**
 * Derive the access key for a student.
 * - If studentNo is provided: UPPER(surname + studentNo)
 * - If studentNo is blank/null: UPPER(surname)
 */
export function deriveAccessKey(surname, studentNo) {
  const base = studentNo ? `${surname}${studentNo}` : surname;
  return base.trim().toUpperCase();
}

/**
 * Look up a student by section name + surname + student number.
 * Returns { student, activities, scores, appeals, makeupRequests } or null.
 */
export async function lookupStudent(sectionName, surname, studentNo) {
  const accessKey = deriveAccessKey(surname, studentNo);
  const cleanSection = sectionName.trim();

  // 1. Find the section
  const { data: section, error: sectionErr } = await supabase
    .from('sections')
    .select('id, name')
    .eq('name', cleanSection)
    .eq('archived', false)
    .single();

  if (sectionErr || !section) return { error: 'Section not found.' };

  // 2. Find the student in that section
  const { data: student, error: studentErr } = await supabase
    .from('students')
    .select('id, surname, first_name, student_no, section_id')
    .eq('section_id', section.id)
    .eq('access_key', accessKey)
    .single();

  if (studentErr || !student) {
    return { error: 'No student found with those credentials. Check your surname and student number.' };
  }

  // 3. Fetch activities for this section (non-archived, ordered)
  const { data: activities, error: actErr } = await supabase
    .from('activities')
    .select('id, title, max_score, order_index')
    .eq('section_id', section.id)
    .eq('archived', false)
    .order('order_index', { ascending: true });

  if (actErr) return { error: 'Failed to load activities.' };

  // 4. Fetch scores for this student
  const { data: scores, error: scoresErr } = await supabase
    .from('scores')
    .select('id, activity_id, score, status')
    .eq('student_id', student.id);

  if (scoresErr) return { error: 'Failed to load scores.' };

  // 5. Fetch this student's appeals
  const { data: appeals, error: appealsErr } = await supabase
    .from('appeals')
    .select('id, activity_id, reason, notes, status, instructor_remarks, created_at')
    .eq('student_id', student.id);

  if (appealsErr) return { error: 'Failed to load appeals.' };

  // 6. Fetch this student's makeup requests
  const { data: makeupRequests, error: makeupErr } = await supabase
    .from('makeup_requests')
    .select('id, activity_id, student_notes, status, created_at')
    .eq('student_id', student.id);

  if (makeupErr) return { error: 'Failed to load makeup requests.' };

  return {
    student: { ...student, sectionName: section.name },
    activities,
    scores,
    appeals,
    makeupRequests,
  };
}

/**
 * Submit an appeal for a specific activity.
 */
export async function submitAppeal({ studentId, activityId, reason, notes }) {
  const { data, error } = await supabase
    .from('appeals')
    .insert({ student_id: studentId, activity_id: activityId, reason, notes: notes || null })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }
  return { data };
}

/**
 * Submit a makeup request for a missing activity.
 */
export async function submitMakeupRequest({ studentId, activityId, studentNotes }) {
  // Check if a request already exists
  const { data: existing } = await supabase
    .from('makeup_requests')
    .select('id, status')
    .eq('student_id', studentId)
    .eq('activity_id', activityId)
    .single();

  if (existing) {
    return { error: 'You have already submitted a request for this activity.', existing };
  }

  const { data, error } = await supabase
    .from('makeup_requests')
    .insert({
      student_id: studentId,
      activity_id: activityId,
      student_notes: studentNotes || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}
