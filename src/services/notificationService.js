/**
 * Notification Service (Email Dispatch)
 * Non-blocking, optional notification dispatcher.
 * If VITE_RESEND_API_KEY is not configured, it gracefully logs and skips without error.
 */

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY || '';
const SENDER_EMAIL = import.meta.env.VITE_NOTIFICATION_SENDER || 'Activity Tracker <onboarding@resend.dev>';

/**
 * Helper to dispatch email via Resend API.
 * Never throws; returns { success, skipped, error }.
 */
async function dispatchEmail({ to, subject, htmlText, plainText }) {
  if (!RESEND_API_KEY || !RESEND_API_KEY.trim()) {
    console.info(`[Notification] No VITE_RESEND_API_KEY configured. Skipping email to: ${to}`);
    return { success: true, skipped: true };
  }

  if (!to || !to.includes('@')) {
    console.warn(`[Notification] Invalid or missing recipient email: ${to}`);
    return { success: false, skipped: true, error: 'Invalid recipient email' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: SENDER_EMAIL,
        to: [to.trim()],
        subject,
        html: htmlText,
        text: plainText,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.warn('[Notification] Resend API response not ok:', errData);
      return { success: false, error: errData };
    }

    const data = await response.json();
    console.info('[Notification] Email dispatched successfully:', data.id);
    return { success: true, data };
  } catch (err) {
    console.warn('[Notification] Error dispatching email:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send Make-up Request decision notification to student.
 */
export async function sendMakeupDecisionEmail({
  studentEmail,
  studentName = 'Student',
  activityTitle = 'Activity',
  decision, // 'approved' | 'rejected'
  remarks = '',
  instructionsUrl = '',
}) {
  const isApproved = decision === 'approved';
  const statusLabel = isApproved ? 'Approved' : 'Rejected';
  const subject = `Make-Up Request ${statusLabel}: ${activityTitle}`;

  const plainText = isApproved
    ? `Hello ${studentName},\n\nYour make-up request for "${activityTitle}" has been APPROVED.\nPlease log in to your Activity Tracker to review the submission guidelines and instructions.\n\n${remarks ? `Instructor Remarks: ${remarks}\n\n` : ''}Thank you.`
    : `Hello ${studentName},\n\nYour make-up request for "${activityTitle}" has been REJECTED.\n\nReason/Remarks:\n${remarks || 'Please consult your instructor.'}\n\nPlease check your Activity Tracker for details.\n\nThank you.`;

  const htmlText = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: ${isApproved ? '#16a34a' : '#dc2626'}; margin-top: 0;">
        Make-Up Request ${statusLabel}
      </h2>
      <p style="font-size: 16px; color: #334155;">Hello <strong>${studentName}</strong>,</p>
      <p style="font-size: 15px; color: #475569; line-height: 1.5;">
        Your make-up request for <strong>${activityTitle}</strong> has been <strong>${statusLabel.toLowerCase()}</strong> by your instructor.
      </p>
      ${
        remarks
          ? `<div style="background: #f8fafc; border-left: 4px solid ${isApproved ? '#16a34a' : '#dc2626'}; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
               <div style="font-size: 13px; font-weight: 600; color: #64748b; margin-bottom: 4px;">Instructor Remarks:</div>
               <div style="font-size: 14px; color: #1e293b;">${remarks}</div>
             </div>`
          : ''
      }
      <p style="font-size: 14px; color: #64748b; margin-top: 24px;">
        Please access the student portal to view updated task instructions or contact your instructor.
      </p>
    </div>
  `;

  return dispatchEmail({
    to: studentEmail,
    subject,
    plainText,
    htmlText,
  });
}

/**
 * Send Appeal decision notification to student.
 */
export async function sendAppealDecisionEmail({
  studentEmail,
  studentName = 'Student',
  activityTitle = 'Activity',
  decision, // 'resolved' | 'rejected'
  remarks = '',
  adjustedScore = null,
}) {
  const isResolved = decision === 'resolved';
  const statusLabel = isResolved ? 'Resolved / Approved' : 'Rejected';
  const subject = `Grade Appeal Update: ${activityTitle}`;

  const plainText = isResolved
    ? `Hello ${studentName},\n\nYour score appeal for "${activityTitle}" has been RESOLVED.${adjustedScore !== null ? ` Updated Score: ${adjustedScore}` : ''}\n\n${remarks ? `Instructor Remarks: ${remarks}\n\n` : ''}Check your Activity Tracker portal for full details.`
    : `Hello ${studentName},\n\nYour score appeal for "${activityTitle}" has been REJECTED.\n\nReason: ${remarks || 'See instructor.'}\n\nCheck your portal for details.`;

  const htmlText = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: ${isResolved ? '#16a34a' : '#dc2626'}; margin-top: 0;">
        Grade Appeal ${statusLabel}
      </h2>
      <p style="font-size: 16px; color: #334155;">Hello <strong>${studentName}</strong>,</p>
      <p style="font-size: 15px; color: #475569; line-height: 1.5;">
        Your appeal for <strong>${activityTitle}</strong> has been reviewed.
      </p>
      ${
        adjustedScore !== null
          ? `<p style="font-size: 15px; color: #16a34a; font-weight: 600;">
               Updated Score: ${adjustedScore}
             </p>`
          : ''
      }
      ${
        remarks
          ? `<div style="background: #f8fafc; border-left: 4px solid #64748b; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
               <div style="font-size: 13px; font-weight: 600; color: #64748b; margin-bottom: 4px;">Instructor Remarks:</div>
               <div style="font-size: 14px; color: #1e293b;">${remarks}</div>
             </div>`
          : ''
      }
      <p style="font-size: 14px; color: #64748b; margin-top: 24px;">
        Your portal record has been updated accordingly.
      </p>
    </div>
  `;

  return dispatchEmail({
    to: studentEmail,
    subject,
    plainText,
    htmlText,
  });
}
