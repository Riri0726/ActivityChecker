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
    .select('id, activity_id, reason, notes, storage_path, proof_deleted_at, status, instructor_remarks, created_at')
    .eq('student_id', student.id);

  if (appealsErr) return { error: 'Failed to load appeals.' };

  // 6. Fetch this student's makeup requests (with linked makeup activity details)
  const { data: makeupRequests, error: makeupErr } = await supabase
    .from('makeup_requests')
    .select(`
      id, activity_id, makeup_activity_id, student_notes, student_submission_link, status, created_at,
      makeup_activities ( id, title, description, instructions )
    `)
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
 * Upload an appeal proof screenshot to Supabase Storage (appeal-proofs bucket).
 * Max size: 5MB. Allowed: image/jpeg, image/png, image/webp.
 */
export async function uploadAppealProof(file, sectionId, studentId) {
  if (!file) return { error: 'No file provided.' };

  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_SIZE) {
    return { error: 'File size exceeds 5MB limit. Please upload a smaller image.' };
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Only JPG, PNG, and WEBP images are supported.' };
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${sectionId || 'unknown'}/${studentId || 'unknown'}/${Date.now()}_${cleanName}`;

  const { data, error } = await supabase.storage
    .from('appeal-proofs')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    return { error: `Upload failed: ${error.message}` };
  }

  const { data: urlData } = supabase.storage
    .from('appeal-proofs')
    .getPublicUrl(data.path);

  return { storagePath: data.path, publicUrl: urlData?.publicUrl };
}

/**
 * Submit an appeal for a specific activity.
 */
export async function submitAppeal({ studentId, activityId, reason, notes, storagePath }) {
  const { data, error } = await supabase
    .from('appeals')
    .insert({
      student_id: studentId,
      activity_id: activityId,
      reason,
      notes: notes || null,
      storage_path: storagePath || null,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }
  return { data };
}

/**
 * Query active makeup activities linked specifically to a missing activity.
 */
export async function getMakeupOptionsForActivity(activityId) {
  const { data, error } = await supabase
    .from('activity_makeup_links')
    .select(`
      makeup_activity_id,
      makeup_activities (
        id, title, description, instructions, archived
      )
    `)
    .eq('activity_id', activityId);

  if (error) throw new Error(error.message);

  const activeOptions = (data || [])
    .map((item) => item.makeup_activities)
    .filter((task) => task && !task.archived);

  return activeOptions;
}

/**
 * Submit a makeup request for a missing activity.
 */
export async function submitMakeupRequest({
  studentId,
  activityId,
  makeupActivityId,
  studentNotes,
  studentSubmissionLink,
}) {
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

  // If no makeup task is linked yet, status is 'awaiting_assignment'
  const initialStatus = makeupActivityId ? 'pending' : 'awaiting_assignment';

  const { data, error } = await supabase
    .from('makeup_requests')
    .insert({
      student_id: studentId,
      activity_id: activityId,
      makeup_activity_id: makeupActivityId || null,
      student_notes: studentNotes || null,
      student_submission_link: studentSubmissionLink || null,
      status: initialStatus,
    })
    .select(`
      id, activity_id, makeup_activity_id, student_notes, student_submission_link, status, created_at,
      makeup_activities ( id, title, description, instructions )
    `)
    .single();

  if (error) return { error: error.message };
  return { data };
}
