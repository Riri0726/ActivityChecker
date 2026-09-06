import { useState, useMemo } from 'react';
import AppealForm from './AppealForm.jsx';
import MakeupRequestForm from './MakeupRequestForm.jsx';
import './StudentDashboard.css';

function calcPercentage(score, maxScore) {
  if (score === null || score === undefined || maxScore === 0) return null;
  return Math.round((score / maxScore) * 100);
}

function ScoreSummary({ activities, scores }) {
  const { totalScore, totalMax } = useMemo(() => {
    let totalScore = 0, totalMax = 0;
    for (const act of activities) {
      const sc = scores.find((s) => s.activity_id === act.id);
      totalMax += act.max_score || 0;
      if (sc && sc.status === 'done' && sc.score !== null) {
        totalScore += sc.score;
      }
    }
    return { totalScore, totalMax };
  }, [activities, scores]);

  const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null;

  return (
    <div className="score-summary">
      <div className="score-summary__label">Total Score</div>
      <div className="score-summary__value">
        {totalScore} <span className="score-summary__max">/ {totalMax}</span>
      </div>
      {pct !== null && (
        <div className="score-summary__pct">{pct}%</div>
      )}
      <div className="score-summary__bar-wrap">
        <div
          className="score-summary__bar"
          style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function StudentDashboard({
  student, activities, scores, appeals, makeupRequests, onBack
}) {
  const [appealTarget, setAppealTarget] = useState(null);   // activity to appeal
  const [makeupTarget, setMakeupTarget] = useState(null);   // activity to request makeup
  const [localAppeals, setLocalAppeals] = useState(appeals ?? []);
  const [localRequests, setLocalRequests] = useState(makeupRequests ?? []);

  const getScore = (actId) => scores.find((s) => s.activity_id === actId);
  const getAppeal = (actId) => localAppeals.find((a) => a.activity_id === actId);
  const getRequest = (actId) => localRequests.find((r) => r.activity_id === actId);

  return (
    <div className="dashboard-page">
      <div className="container">
        {/* Header */}
        <header className="dashboard-header">
          <button
            id="back-to-lookup-btn"
            className="btn btn-ghost btn-sm"
            onClick={onBack}
            aria-label="Back to lookup form"
          >
            ← Back
          </button>
          <div className="student-info">
            <div className="student-avatar" aria-hidden="true">
              {student.first_name?.[0]}{student.surname?.[0]}
            </div>
            <div>
              <h1 className="student-name">
                {student.first_name} {student.surname}
              </h1>
              <div className="student-meta">
                <span className="badge badge-pending">{student.sectionName}</span>
                {student.student_no && (
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                    #{student.student_no}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Score Summary (top) */}
        <ScoreSummary activities={activities} scores={scores} />

        {/* Activities Table */}
        <section className="activities-section">
          <h2 className="section-title">Activities</h2>

          {activities.length === 0 ? (
            <div className="card text-center" style={{ padding: 'var(--sp-10)' }}>
              <p>No activities found for your section yet.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table aria-label="Activity scores">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Activity</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((act, idx) => {
                    const sc      = getScore(act.id);
                    const appeal  = getAppeal(act.id);
                    const request = getRequest(act.id);
                    const isMissing = !sc || sc.status === 'missing';
                    const pct = sc && !isMissing
                      ? calcPercentage(sc.score, act.max_score)
                      : null;

                    return (
                      <tr
                        key={act.id}
                        className={isMissing ? 'row-missing' : ''}
                      >
                        <td className="text-muted" style={{ width: 40 }}>{idx + 1}</td>
                        <td>
                          <span className="act-title">{act.title}</span>
                          {act.max_score > 0 && (
                            <span className="act-max text-muted"> / {act.max_score} pts</span>
                          )}
                        </td>
                        <td>
                          {isMissing
                            ? <span className="badge badge-missing">⚠ Missing</span>
                            : <span className="badge badge-done">✓ Done</span>
                          }
                        </td>
                        <td>
                          {isMissing ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <span className="score-cell">
                              <strong>{sc.score}</strong>
                              {act.max_score > 0 && (
                                <span className="text-muted"> / {act.max_score}</span>
                              )}
                              {pct !== null && (
                                <span className="score-pct">{pct}%</span>
                              )}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="act-actions">
                            {/* Appeal button — any activity */}
                            {appeal ? (
                              <span className={`badge badge-${appeal.status}`}>
                                Appeal: {appeal.status}
                              </span>
                            ) : (
                              <button
                                id={`appeal-btn-${act.id}`}
                                className="btn btn-ghost btn-sm"
                                onClick={() => setAppealTarget(act)}
                              >
                                Appeal
                              </button>
                            )}

                            {/* Makeup request — only for missing */}
                            {isMissing && (
                              request ? (
                                <span className={`badge badge-${request.status}`}>
                                  Request: {request.status}
                                </span>
                              ) : (
                                <button
                                  id={`makeup-btn-${act.id}`}
                                  className="btn btn-sm"
                                  style={{
                                    background: 'var(--color-warning-light)',
                                    color: '#92400e',
                                    border: '1px solid #fcd34d',
                                  }}
                                  onClick={() => setMakeupTarget(act)}
                                >
                                  Request Make-up
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Score Summary (bottom) */}
        <ScoreSummary activities={activities} scores={scores} />
      </div>

      {/* Appeal Modal */}
      {appealTarget && (
        <AppealForm
          student={student}
          activity={appealTarget}
          onClose={() => setAppealTarget(null)}
          onSuccess={(newAppeal) => {
            setLocalAppeals((prev) => [...prev, newAppeal]);
            setAppealTarget(null);
          }}
        />
      )}

      {/* Makeup Request Modal */}
      {makeupTarget && (
        <MakeupRequestForm
          student={student}
          activity={makeupTarget}
          onClose={() => setMakeupTarget(null)}
          onSuccess={(newReq) => {
            setLocalRequests((prev) => [...prev, newReq]);
            setMakeupTarget(null);
          }}
        />
      )}
    </div>
  );
}
