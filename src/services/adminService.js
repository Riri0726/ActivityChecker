import { supabase } from './supabase.js';
import { sendMakeupDecisionEmail, sendAppealDecisionEmail } from './notificationService.js';

// ============================================================
// ADMIN & TEACHER MANAGEMENT (Super-Admin)
// ============================================================

export async function getAdmins() {
  const { data, error } = await supabase
    .from('admins')
    .select('id, email, full_name, role, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to load admins: ${error.message}`);
  return data || [];
}

export async function upsertAdmin({ id, email, fullName, role = 'teacher' }) {
  const { data, error } = await supabase
    .from('admins')
    .upsert(
      {
        id,
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        role,
      },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to save admin profile: ${error.message}`);
  return data;
}

export async function updateAdminRole(adminId, role) {
  const { error } = await supabase
    .from('admins')
    .update({ role })
    .eq('id', adminId);

  if (error) throw new Error(`Failed to update admin role: ${error.message}`);
}

export async function deleteAdmin(adminId) {
  const { error } = await supabase
    .from('admins')
    .delete()
    .eq('id', adminId);

  if (error) throw new Error(`Failed to delete admin: ${error.message}`);
}

export async function updateAdminTheme(adminId, theme) {
  const { error } = await supabase
    .from('admins')
    .update({ theme })
    .eq('id', adminId);

  if (error) throw new Error(`Failed to update theme: ${error.message}`);
}

export async function createAdminAccount({ email, fullName, role = 'teacher', tempPassword }) {
  // 1. Create auth user via signUp (does not sign out current session when email confirmation is enabled)
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password: tempPassword,
    options: {
      data: { full_name: fullName, auto_created: true },
    },
  });

  if (authErr) throw new Error(`Failed to create auth account: ${authErr.message}`);

  const newUserId = authData?.user?.id;
  if (!newUserId) throw new Error('Auth account created but no user ID returned.');

  // 2. Insert into admins table
  const { data: adminData, error: adminErr } = await supabase
    .from('admins')
    .upsert(
      {
        id: newUserId,
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        role,
      },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (adminErr) {
    console.warn('Admin profile insert warning:', adminErr.message);
  }

  return { user: authData.user, admin: adminData };
}

// ============================================================
// SUBJECT MANAGEMENT
// ============================================================

export async function getSubjects(adminId = null) {
  let query = supabase
    .from('subjects')
    .select(`
      id, code, name, description, admin_id, created_at,
      admins ( id, full_name, email )
    `)
    .order('code', { ascending: true });

  if (adminId) {
    query = query.eq('admin_id', adminId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load subjects: ${error.message}`);
  return data || [];
}

export async function createSubject({ code, name, description = '', adminId }) {
  const { data, error } = await supabase
    .from('subjects')
    .insert({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description?.trim() || null,
      admin_id: adminId,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create subject: ${error.message}`);
  return data;
}

export async function updateSubject(id, { code, name, description }) {
  const payload = {};
  if (code !== undefined) payload.code = code.trim().toUpperCase();
  if (name !== undefined) payload.name = name.trim();
  if (description !== undefined) payload.description = description?.trim() || null;

  const { data, error } = await supabase
    .from('subjects')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update subject: ${error.message}`);
  return data;
}

export async function deleteSubject(id) {
  const { error } = await supabase
    .from('subjects')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete subject: ${error.message}`);
}

// ============================================================
// SECTION MANAGEMENT
// ============================================================

export async function upsertSection(name, subjectId = null, adminId = null) {
  const cleanName = name.trim();
  const payload = { name: cleanName };
  if (subjectId) payload.subject_id = subjectId;
  if (adminId) payload.admin_id = adminId;

  const { data, error } = await supabase
    .from('sections')
    .upsert(payload, { onConflict: 'name', ignoreDuplicates: false })
    .select('id, name, subject_id, admin_id')
    .single();

  if (error) throw new Error(`Failed to upsert section "${cleanName}": ${error.message}`);
  return data;
}

export async function getSections(subjectId = null, adminId = null) {
  let query = supabase
    .from('sections')
    .select('id, name, subject_id, admin_id, archived')
    .eq('archived', false)
    .order('name');

  if (subjectId) {
    query = query.eq('subject_id', subjectId);
  }
  if (adminId) {
    query = query.eq('admin_id', adminId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load sections: ${error.message}`);
  return data || [];
}

// ============================================================
// PERMANENT SECTION (WORKBOOK) DELETION
// ============================================================

export async function getSectionDeleteSummary(sectionId) {
  const [studentsRes, activitiesRes, scoresRes] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('section_id', sectionId),
    supabase.from('activities').select('*', { count: 'exact', head: true }).eq('section_id', sectionId),
    supabase.from('scores').select('*', { count: 'exact', head: true }).in(
      'student_id',
      (await supabase.from('students').select('id').eq('section_id', sectionId)).data?.map(s => s.id) || []
    ),
  ]);

  return {
    students: studentsRes.count || 0,
    activities: activitiesRes.count || 0,
    scores: scoresRes.count || 0,
  };
}

export async function deleteSection(sectionId) {
  // Cascade: students, activities, scores all have ON DELETE CASCADE
  const { error } = await supabase
    .from('sections')
    .delete()
    .eq('id', sectionId);

  if (error) throw new Error(`Failed to delete section: ${error.message}`);
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

export async function updateStudent(studentId, { surname, firstName, studentNo }) {
  const payload = {};
  if (surname !== undefined) payload.surname = surname.trim();
  if (firstName !== undefined) payload.first_name = firstName.trim();
  if (studentNo !== undefined) payload.student_no = studentNo?.trim() || null;

  // Regenerate access_key if surname or student_no changed (both affect login credentials)
  if (payload.surname || payload.first_name || payload.student_no !== undefined) {
    // Fetch current data to build the new key
    const { data: current } = await supabase
      .from('students')
      .select('surname, first_name, student_no')
      .eq('id', studentId)
      .single();

    const finalSurname = payload.surname || current?.surname || '';
    const finalStudentNo = payload.student_no !== undefined ? payload.student_no : (current?.student_no || '');
    payload.access_key = (finalSurname + (finalStudentNo || '')).toUpperCase().replace(/\s/g, '');
  }

  const { data, error } = await supabase
    .from('students')
    .update(payload)
    .eq('id', studentId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update student: ${error.message}`);
  return data;
}

// ============================================================
// ACTIVITY MANAGEMENT
// ============================================================

export async function upsertActivity(sectionId, {
  title,
  maxScore,
  orderIndex,
  subjectId = null,
  adminId = null,
  makeupTaskId = null,
  acceptingRequests = true,
  requestDeadline = null,
}) {
  const payload = {
    section_id: sectionId,
    title: title.trim(),
    max_score: maxScore,
    order_index: orderIndex,
    archived: false,
    accepting_requests: acceptingRequests,
    request_deadline: requestDeadline,
  };
  if (subjectId) payload.subject_id = subjectId;
  if (adminId) payload.admin_id = adminId;
  if (makeupTaskId) payload.makeup_task_id = makeupTaskId;

  const { data, error } = await supabase
    .from('activities')
    .upsert(payload, { onConflict: 'section_id,title', ignoreDuplicates: false })
    .select('id, title, max_score, accepting_requests, request_deadline, makeup_task_id')
    .single();

  if (error) throw new Error(`Failed to upsert activity "${title}": ${error.message}`);
  return data;
}

export async function updateActivitySettings(activityId, { acceptingRequests, requestDeadline, makeupTaskId }) {
  const payload = {};
  if (acceptingRequests !== undefined) payload.accepting_requests = acceptingRequests;
  if (requestDeadline !== undefined) payload.request_deadline = requestDeadline;
  if (makeupTaskId !== undefined) payload.makeup_task_id = makeupTaskId || null;

  const { data, error } = await supabase
    .from('activities')
    .update(payload)
    .eq('id', activityId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update activity settings: ${error.message}`);
  return data;
}

export async function archiveRemovedActivities(sectionId, uploadedTitles) {
  const { data: existing } = await supabase
    .from('activities')
    .select('id, title')
    .eq('section_id', sectionId)
    .eq('archived', false);

  if (!existing || existing.length === 0) return [];

  const uploadedSet = new Set(uploadedTitles.map((t) => t.trim().toLowerCase()));
  const toArchive = existing.filter((a) => !uploadedSet.has(a.title.trim().toLowerCase()));

  if (toArchive.length === 0) return [];

  const ids = toArchive.map((a) => a.id);
  const { error } = await supabase
    .from('activities')
    .update({ archived: true })
    .in('id', ids);

  if (error) throw new Error(`Failed to archive removed activities: ${error.message}`);
  return toArchive;
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

export async function updateScoreInline(scoreId, newScore) {
  const isBlank = newScore === null || newScore === undefined || newScore === '';
  const score = isBlank ? null : parseFloat(newScore);
  const status = isBlank ? 'missing' : 'done';

  const { error } = await supabase
    .from('scores')
    .update({ score, status, updated_at: new Date().toISOString() })
    .eq('id', scoreId);

  if (error) throw new Error(`Failed to update score: ${error.message}`);
}

// ============================================================
// FULL WORKBOOK IMPORT WITH SUBJECT & ADMIN CONTEXT
// ============================================================

export async function importParsedWorkbook(parsedSheets, subjectId = null, adminId = null) {
  const importSummary = [];

  for (const sheet of parsedSheets) {
    const { sectionName, students, activities, scores, duplicates } = sheet;

    // 1. Upsert section
    const section = await upsertSection(sectionName, subjectId, adminId);

    // 2. Upsert activities + build title→id map
    const activityMap = {};
    for (const act of activities) {
      const saved = await upsertActivity(section.id, {
        ...act,
        subjectId,
        adminId,
      });
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
// APPEALS MANAGEMENT & EPHEMERAL PROOF PURGE
// ============================================================

export async function getAppeals(filters = {}) {
  let query = supabase
    .from('appeals')
    .select(`
      id, reason, notes, storage_path, proof_purged_at, proof_deleted_at, status, instructor_remarks, created_at,
      students ( id, surname, first_name, student_no, section_id,
        sections ( id, name, subject_id, admin_id )
      ),
      activities ( id, title, max_score, section_id )
    `)
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.sectionId) {
    query = query.eq('students.section_id', filters.sectionId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load appeals: ${error.message}`);
  return data || [];
}

export function getProofImageUrl(storagePath) {
  if (!storagePath) return null;
  const { data } = supabase.storage.from('appeal-proofs').getPublicUrl(storagePath);
  return data?.publicUrl;
}

export async function getProofSignedUrl(storagePath) {
  if (!storagePath) return null;
  const { data, error } = await supabase.storage.from('appeal-proofs').createSignedUrl(storagePath, 3600);
  if (error) return getProofImageUrl(storagePath);
  return data?.signedUrl;
}

export async function updateAppealWithPurge(appealId, {
  status, // 'resolved' | 'rejected'
  instructorRemarks = '',
  adjustedScore = null,
  studentId = null,
  activityId = null,
  studentEmail = null,
  studentName = 'Student',
  activityTitle = 'Activity',
}) {
  const shouldPurge = status === 'resolved' || status === 'rejected';
  const nowIso = new Date().toISOString();

  const updatePayload = {
    status,
    instructor_remarks: instructorRemarks || null,
  };

  // Auto-purge proof image to preserve Supabase free tier storage
  if (shouldPurge) {
    const { data: appealData } = await supabase
      .from('appeals')
      .select('storage_path')
      .eq('id', appealId)
      .single();

    if (appealData?.storage_path) {
      try {
        await supabase.storage.from('appeal-proofs').remove([appealData.storage_path]);
      } catch (purgeErr) {
        console.warn('[Storage Purge] Warning while removing image:', purgeErr);
      }
      updatePayload.storage_path = null;
      updatePayload.proof_purged_at = nowIso;
      updatePayload.proof_deleted_at = nowIso;
    }
  }

  // Update appeal record
  const { error: appealErr } = await supabase
    .from('appeals')
    .update(updatePayload)
    .eq('id', appealId);

  if (appealErr) throw new Error(`Failed to update appeal: ${appealErr.message}`);

  // If score was adjusted on resolve, update scores table
  if (status === 'resolved' && adjustedScore !== null && studentId && activityId) {
    const numScore = parseFloat(adjustedScore);
    await upsertScore(studentId, activityId, isNaN(numScore) ? null : numScore, 'done');
  }

  // Optional transactional email dispatch (graceful fallback)
  if (studentEmail) {
    sendAppealDecisionEmail({
      studentEmail,
      studentName,
      activityTitle,
      decision: status,
      remarks: instructorRemarks,
      adjustedScore,
    }).catch((e) => console.warn('[Notification Error]:', e));
  }
}

// Backwards compatibility alias
export const updateAppeal = (appealId, options) =>
  updateAppealWithPurge(appealId, options);

// ============================================================
// TWO-STAGE MAKE-UP WORKFLOW & MAKEUP TASKS POOL
// ============================================================

export async function getMakeupTasks(subjectId = null, sectionId = null) {
  let query = supabase
    .from('makeup_tasks')
    .select('*')
    .eq('archived', false)
    .order('created_at', { ascending: false });

  if (subjectId) query = query.eq('subject_id', subjectId);
  if (sectionId) query = query.eq('section_id', sectionId);

  const { data, error } = await query;
  if (error) {
    // If table doesn't exist yet, fall back to legacy makeup_activities
    return getLegacyMakeupActivities();
  }
  return data || [];
}

export async function createMakeupTask({
  adminId = null,
  subjectId = null,
  sectionId = null,
  title,
  submissionMode = 'gdrive_link',
  instructions,
  submissionUrl = '',
}) {
  const { data, error } = await supabase
    .from('makeup_tasks')
    .insert({
      admin_id: adminId,
      subject_id: subjectId,
      section_id: sectionId,
      title: title.trim(),
      submission_mode: submissionMode,
      instructions: instructions.trim(),
      submission_url: submissionUrl?.trim() || null,
      archived: false,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create make-up task: ${error.message}`);
  return data;
}

export async function updateMakeupTask(id, fields) {
  const payload = { ...fields };
  const { data, error } = await supabase
    .from('makeup_tasks')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update make-up task: ${error.message}`);
  return data;
}

export async function deleteMakeupTask(id) {
  const { error } = await supabase
    .from('makeup_tasks')
    .update({ archived: true })
    .eq('id', id);

  if (error) throw new Error(`Failed to archive make-up task: ${error.message}`);
}

export async function getMakeupRequests(filters = {}) {
  let query = supabase
    .from('makeup_requests')
    .select(`
      id, student_email, reason, student_notes, student_submission_link, submission_link,
      status, instructor_remarks, created_at, makeup_task_id,
      students ( id, surname, first_name, student_no, section_id,
        sections ( id, name, subject_id )
      ),
      activities ( id, title, max_score, accepting_requests, request_deadline ),
      makeup_tasks ( id, title, submission_mode, instructions, submission_url )
    `)
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load makeup requests: ${error.message}`);
  return data || [];
}

/**
 * Instructor decides on a two-stage make-up request.
 * - 'approve': sets status to 'approved_pending_submission', attaches makeup_task_id
 * - 'reject': sets status to 'rejected', records remarks
 * - 'complete': marks done after student submission
 */
export async function decideMakeupRequest({
  requestId,
  decision, // 'approved' | 'rejected' | 'completed'
  makeupTaskId = null,
  instructorRemarks = '',
  studentEmail = '',
  studentName = 'Student',
  activityTitle = 'Activity',
  instructionsUrl = '',
}) {
  let dbStatus = decision;
  if (decision === 'approved') {
    dbStatus = 'approved_pending_submission';
  } else if (decision === 'rejected') {
    dbStatus = 'rejected';
  }

  const payload = {
    status: dbStatus,
    instructor_remarks: instructorRemarks || null,
  };
  if (makeupTaskId) {
    payload.makeup_task_id = makeupTaskId;
  }

  const { data, error } = await supabase
    .from('makeup_requests')
    .update(payload)
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update make-up request: ${error.message}`);

  // Optional email dispatch (graceful fallback)
  if (studentEmail && (decision === 'approved' || decision === 'rejected')) {
    sendMakeupDecisionEmail({
      studentEmail,
      studentName,
      activityTitle,
      decision,
      remarks: instructorRemarks,
      instructionsUrl,
    }).catch((e) => console.warn('[Notification Error]:', e));
  }

  return data;
}

// Legacy helpers for backwards compatibility
export async function getLegacyMakeupActivities() {
  const { data } = await supabase
    .from('makeup_activities')
    .select('*')
    .eq('archived', false);
  return data || [];
}

export async function getMakeupActivities() {
  // Return combined or makeup_tasks
  const tasks = await getMakeupTasks();
  return tasks;
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
    .select('id, title, max_score, order_index, accepting_requests, request_deadline, makeup_task_id')
    .eq('section_id', sectionId)
    .eq('archived', false)
    .order('order_index');

  if (aErr) throw new Error(`Failed to load activities: ${aErr.message}`);

  // Scores
  const studentIds = students.map((s) => s.id);
  const { data: scores, error: scErr } = await supabase
    .from('scores')
    .select('id, student_id, activity_id, score, status')
    .in('student_id', studentIds);

  if (scErr) throw new Error(`Failed to load scores: ${scErr.message}`);

  return { students, activities, scores };
}

// ============================================================
// NOTIFICATION COUNTS (admin badge)
// ============================================================

export async function getPendingCounts() {
  const [{ count: appeals }, { count: requests }] = await Promise.all([
    supabase
      .from('appeals')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'pending_review']),
    supabase
      .from('makeup_requests')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'pending_review']),
  ]);

  return { pendingAppeals: appeals || 0, pendingRequests: requests || 0 };
}
