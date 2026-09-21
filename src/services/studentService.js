import { supabase } from './supabase.js';
import imageCompression from 'browser-image-compression';

/**
 * Derive the access key for a student.
 * - If studentNo is provided: UPPER(surname + studentNo)
 * - If studentNo is blank/null: UPPER(surname)
 */
export function deriveAccessKey(surname, studentNo) {
  const s = (surname || '').trim();
  const num = (studentNo || '').trim();
  const base = num ? `${s}${num}` : s;
  return base.toUpperCase();
}

/**
 * Public subjects for student lookup filter
 */
export async function getPublicSubjects() {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, code, name')
    .order('code', { ascending: true });

  if (error) {
    console.warn('Could not load subjects:', error);
    return [];
  }
  return data || [];
}

/**
 * Public sections for student lookup filter
 */
export async function getPublicSections(subjectId = null) {
  let query = supabase
    .from('sections')
    .select('id, name, subject_id')
    .eq('archived', false)
    .order('name');

  if (subjectId) {
    query = query.eq('subject_id', subjectId);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('Could not load sections:', error);
    return [];
  }
  return data || [];
}

/**
 * Look up a student by section name + surname + student number (with optional subjectId).
 * Returns { student, activities, scores, appeals, makeupRequests } or error.
 */
export async function lookupStudent(sectionName, surname, studentNo, subjectId = null) {
  const accessKey = deriveAccessKey(surname, studentNo);
  const cleanSection = sectionName.trim();

  // 1. Find the section
  let secQuery = supabase
    .from('sections')
    .select('id, name, subject_id, admin_id')
    .eq('name', cleanSection)
    .eq('archived', false);

  if (subjectId) {
    secQuery = secQuery.eq('subject_id', subjectId);
  }

  const { data: sections, error: sectionErr } = await secQuery;

  if (sectionErr || !sections || sections.length === 0) {
    return { error: 'Section not found. Please verify the section name.' };
  }

  const section = sections[0];

  // 2a. Fetch the admin's theme for this section (for student-side theming)
  let adminTheme = 'blue';
  if (section.admin_id) {
    const { data: adminData } = await supabase
      .from('admins')
      .select('theme')
      .eq('id', section.admin_id)
      .maybeSingle();
    if (adminData?.theme) adminTheme = adminData.theme;
  }

  // 2b. Find the student in that section
  const { data: student, error: studentErr } = await supabase
    .from('students')
    .select('id, surname, first_name, student_no, section_id')
    .eq('section_id', section.id)
    .eq('access_key', accessKey)
    .maybeSingle();

  if (studentErr || !student) {
    return { error: 'No student found with those credentials. Check your surname and student number.' };
  }

  // 3. Fetch activities for this section (non-archived, ordered)
  const { data: activities, error: actErr } = await supabase
    .from('activities')
    .select(`
      id, title, max_score, order_index,
      accepting_requests, request_deadline, makeup_task_id,
      makeup_tasks ( id, title, submission_mode, instructions, submission_url )
    `)
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
    .select('id, activity_id, reason, notes, storage_path, proof_purged_at, proof_deleted_at, status, instructor_remarks, created_at')
    .eq('student_id', student.id)
    .order('created_at', { ascending: false });

  if (appealsErr) return { error: 'Failed to load appeals.' };

  // 6. Fetch this student's makeup requests (with assigned task details)
  const { data: makeupRequests, error: makeupErr } = await supabase
    .from('makeup_requests')
    .select(`
      id, activity_id, student_email, reason, student_notes, student_submission_link, submission_link,
      status, instructor_remarks, created_at, makeup_task_id,
      makeup_tasks ( id, title, submission_mode, instructions, submission_url )
    `)
    .eq('student_id', student.id)
    .order('created_at', { ascending: false });

  if (makeupErr) return { error: 'Failed to load makeup requests.' };

  return {
    student: { ...student, sectionName: section.name },
    activities: activities || [],
    scores: scores || [],
    appeals: appeals || [],
    makeupRequests: makeupRequests || [],
    adminTheme,
  };
}

/**
 * Compress image client-side under 500KB and upload to private appeal-proofs bucket.
 */
export async function uploadAndCompressAppealProof(file, sectionId, studentId) {
  if (!file) return { error: 'An image proof is strictly mandatory for appeals.' };

  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return { error: 'Only JPG, PNG, and WEBP images are supported.' };
  }

  let fileToUpload = file;
  try {
    const compressionOptions = {
      maxSizeMB: 0.48, // strictly under 500 KB
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: 'image/webp',
    };
    fileToUpload = await imageCompression(file, compressionOptions);
  } catch (compErr) {
    console.warn('Image compression fallback to original:', compErr);
  }

  const cleanSection = sectionId || 'general';
  const cleanStudent = studentId || 'student';
  const timestamp = Date.now();
  const filePath = `${cleanSection}/${cleanStudent}/${timestamp}_proof.webp`;

  const { data, error } = await supabase.storage
    .from('appeal-proofs')
    .upload(filePath, fileToUpload, {
      contentType: 'image/webp',
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    return { error: `Proof upload failed: ${error.message}` };
  }

  return { storagePath: data.path };
}

// Backwards compatibility alias
export const uploadAppealProof = uploadAndCompressAppealProof;

/**
 * Submit an appeal for a specific activity (Strict proof image required).
 */
export async function submitAppeal({ studentId, activityId, reason, notes, storagePath }) {
  if (!storagePath) {
    return { error: 'Image proof attachment is mandatory to dispute a score or missing status.' };
  }

  const { data, error } = await supabase
    .from('appeals')
    .insert({
      student_id: studentId,
      activity_id: activityId,
      reason,
      notes: notes || null,
      storage_path: storagePath,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }
  return { data };
}

/**
 * Stage 1: Student requests make-up with justification and email contact.
 * Gatekept: instructions are NOT revealed until teacher approves.
 */
export async function submitTwoStageMakeupRequest({
  studentId,
  activityId,
  studentEmail,
  reason,
  notes = '',
}) {
  if (!studentEmail || !studentEmail.includes('@')) {
    return { error: 'A valid email address is required for status notifications.' };
  }
  if (!reason || !reason.trim()) {
    return { error: 'Please provide a justification for missing this activity.' };
  }

  // Check activity deadline and accepting status
  const { data: act, error: actErr } = await supabase
    .from('activities')
    .select('id, accepting_requests, request_deadline')
    .eq('id', activityId)
    .single();

  if (actErr || !act) {
    return { error: 'Activity not found.' };
  }

  if (act.accepting_requests === false) {
    return { error: 'Make-up requests are closed for this activity.' };
  }

  if (act.request_deadline && new Date(act.request_deadline) < new Date()) {
    return { error: 'The make-up request deadline for this activity has passed.' };
  }

  // Check if request already exists
  const { data: existing } = await supabase
    .from('makeup_requests')
    .select('id, status')
    .eq('student_id', studentId)
    .eq('activity_id', activityId)
    .maybeSingle();

  if (existing) {
    return {
      error: `A request for this activity is already on file (Status: ${existing.status}).`,
      existing,
    };
  }

  const { data, error } = await supabase
    .from('makeup_requests')
    .insert({
      student_id: studentId,
      activity_id: activityId,
      student_email: studentEmail.trim(),
      reason: reason.trim(),
      student_notes: notes?.trim() || null,
      status: 'pending_review',
    })
    .select(`
      id, activity_id, student_email, reason, student_notes,
      status, created_at
    `)
    .single();

  if (error) return { error: error.message };
  return { data };
}

// Backwards compatibility alias
export const submitMakeupRequest = submitTwoStageMakeupRequest;

/**
 * Stage 2: Student submits Google Drive or turn-in proof link after approval.
 */
export async function submitMakeupProofLink(requestId, submissionLink) {
  if (!submissionLink || !submissionLink.trim()) {
    return { error: 'Submission link or turn-in confirmation is required.' };
  }

  const { data, error } = await supabase
    .from('makeup_requests')
    .update({
      submission_link: submissionLink.trim(),
      student_submission_link: submissionLink.trim(),
      status: 'submitted',
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}
