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

/**
 * Find a student by full name within a section (case-insensitive).
 * Used for name-based matching during Excel re-upload to prevent duplication.
 */
export async function findStudentByName(sectionId, surname, firstName) {
  const { data, error } = await supabase
    .from('students')
    .select('id, surname, first_name, student_no, access_key')
    .eq('section_id', sectionId)
    .ilike('surname', surname.trim())
    .ilike('first_name', firstName.trim())
    .maybeSingle();

  if (error) {
    console.warn(`findStudentByName warning:`, error.message);
    return null;
  }
  return data;
}

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

/**
 * Smart upsert: match by name first (handles student_no changes), then fallback to access_key.
 * Prevents duplicate students when student_no is updated in Excel.
 */
export async function smartUpsertStudent(sectionId, { surname, firstName, studentNo, accessKey }) {
  // 1. Try to find existing student by name
  const existing = await findStudentByName(sectionId, surname, firstName);

  if (existing) {
    // Update existing student's student_no and access_key if changed
    const newAccessKey = accessKey;
    const needsUpdate =
      existing.student_no !== (studentNo || null) ||
      existing.access_key !== newAccessKey;

    if (needsUpdate) {
      const { data, error } = await supabase
        .from('students')
        .update({
          student_no: studentNo || null,
          access_key: newAccessKey,
          surname: surname.trim(),
          first_name: firstName.trim(),
        })
        .eq('id', existing.id)
        .select('id')
        .single();

      if (error) throw new Error(`Failed to update student "${surname} ${firstName}": ${error.message}`);
      return data;
    }
    return { id: existing.id };
  }

  // 2. Fallback: upsert by access_key (new student)
  return upsertStudent(sectionId, { surname, firstName, studentNo, accessKey });
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

/**
 * Delete a student and cascade-delete their scores, appeals, and makeup requests.
 */
export async function deleteStudent(studentId) {
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', studentId);

  if (error) throw new Error(`Failed to delete student: ${error.message}`);
}

/**
 * Delete multiple students by their IDs.
 */
export async function deleteStudentsByIds(studentIds) {
  if (!studentIds || studentIds.length === 0) return;
  const { error } = await supabase
    .from('students')
    .delete()
    .in('id', studentIds);

  if (error) throw new Error(`Failed to delete students: ${error.message}`);
}

/**
 * Add a new student to a section with auto-generated access_key.
 */
export async function addStudentToSection(sectionId, { surname, firstName, studentNo }) {
  const accessKey = (surname.trim() + (studentNo?.trim() || '')).toUpperCase().replace(/\s/g, '');
  return upsertStudent(sectionId, { surname, firstName, studentNo, accessKey });
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
  const MISSING_KEYWORDS = ['missing', 'n/a', 'na', '-', '--', 'none', 'absent', 'inc', 'inc.', 'null', 'undefined'];
  const rawStr = newScore !== null && newScore !== undefined ? String(newScore).trim() : '';
  const isBlank = rawStr === '' || MISSING_KEYWORDS.includes(rawStr.toLowerCase());
  const numVal = isBlank ? null : parseFloat(rawStr);
  const score = isBlank || isNaN(numVal) ? null : numVal;
  const status = score === null ? 'missing' : 'done';

  const { error } = await supabase
    .from('scores')
    .update({ score, status, updated_at: new Date().toISOString() })
    .eq('id', scoreId);

  if (error) throw new Error(`Failed to update score: ${error.message}`);
}

// ============================================================
// FULL WORKBOOK IMPORT WITH SUBJECT & ADMIN CONTEXT
// ============================================================

/**
 * Get all students for a section (used for removed student detection).
 */
export async function getStudentsForSection(sectionId) {
  const { data, error } = await supabase
    .from('students')
    .select('id, surname, first_name, student_no, access_key')
    .eq('section_id', sectionId);

  if (error) throw new Error(`Failed to load students: ${error.message}`);
  return data || [];
}

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

    // 4. Get existing students for removed-student detection
    const existingStudents = await getStudentsForSection(section.id);
    const processedStudentIds = new Set();

    // 5. Upsert students + scores (using smart name-based matching)
    let studentsProcessed = 0;
    for (let i = 0; i < students.length; i++) {
      const studentData = students[i];
      const saved = await smartUpsertStudent(section.id, studentData);
      processedStudentIds.add(saved.id);
      studentsProcessed++;

      const studentScores = scores[i]?.studentScores || [];
      for (const s of studentScores) {
        const act = activityMap[s.activityTitle];
        if (!act) continue;
        await upsertScore(saved.id, act.id, s.score, s.status);
      }
    }

    // 6. Delete students that were removed from the sheet
    const removedStudents = existingStudents.filter((s) => !processedStudentIds.has(s.id));
    let removedCount = 0;
    if (removedStudents.length > 0) {
      const removedIds = removedStudents.map((s) => s.id);
      await deleteStudentsByIds(removedIds);
      removedCount = removedStudents.length;
    }

    importSummary.push({
      sectionName,
      studentsProcessed,
      activitiesProcessed: activities.length,
      archivedCount: archivedActivities?.length || 0,
      removedStudentsCount: removedCount,
      removedStudents: removedStudents.map((s) => `${s.surname} ${s.first_name}`),
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

  let { data, error } = await query;
  if (error) throw new Error(`Failed to load appeals: ${error.message}`);

  // Filter by admin_id via the nested section relationship (client-side)
  if (filters.adminId && data) {
    data = data.filter((a) => a.students?.sections?.admin_id === filters.adminId);
  }

  return data || [];
}

/**
 * Delete an appeal record permanently.
 */
export async function deleteAppeal(appealId) {
  // Also clean up the storage proof if it still exists
  const { data: appealData } = await supabase
    .from('appeals')
    .select('storage_path')
    .eq('id', appealId)
    .single();

  if (appealData?.storage_path) {
    try {
      await supabase.storage.from('appeal-proofs').remove([appealData.storage_path]);
    } catch (e) {
      console.warn('[deleteAppeal] Storage cleanup warning:', e);
    }
  }

  const { error } = await supabase
    .from('appeals')
    .delete()
    .eq('id', appealId);

  if (error) throw new Error(`Failed to delete appeal: ${error.message}`);
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

export async function getMakeupTasks(subjectId = null, sectionId = null, adminId = null) {
  let query = supabase
    .from('makeup_tasks')
    .select('*')
    .eq('archived', false)
    .order('created_at', { ascending: false });

  if (subjectId) query = query.eq('subject_id', subjectId);
  if (sectionId) query = query.eq('section_id', sectionId);
  if (adminId) query = query.or(`admin_id.eq.${adminId},admin_id.is.null`);

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
        sections ( id, name, subject_id, admin_id )
      ),
      activities ( id, title, max_score, accepting_requests, request_deadline ),
      makeup_tasks ( id, title, submission_mode, instructions, submission_url )
    `)
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);

  let { data, error } = await query;
  if (error) throw new Error(`Failed to load makeup requests: ${error.message}`);

  // Filter by admin_id via the nested section relationship (client-side)
  if (filters.adminId && data) {
    data = data.filter((r) => r.students?.sections?.admin_id === filters.adminId);
  }

  return data || [];
}

/**
 * Delete a makeup request record permanently.
 */
export async function deleteMakeupRequest(requestId) {
  const { error } = await supabase
    .from('makeup_requests')
    .delete()
    .eq('id', requestId);

  if (error) throw new Error(`Failed to delete makeup request: ${error.message}`);
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
// NOTIFICATION COUNTS (admin badge — scoped to admin's sections)
// ============================================================

export async function getPendingCounts(adminId = null) {
  // If no adminId, return global counts (backward compatibility)
  if (!adminId) {
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

  // Scoped counts: fetch pending items then filter by admin's sections
  const [appealsData, requestsData] = await Promise.all([
    getAppeals({ adminId }),
    getMakeupRequests({ adminId }),
  ]);

  const pendingAppeals = appealsData.filter((a) => ['pending', 'pending_review'].includes(a.status)).length;
  const pendingRequests = requestsData.filter((r) => ['pending', 'pending_review'].includes(r.status)).length;

  return { pendingAppeals, pendingRequests };
}
