import { useState, useEffect } from 'react';
import { lookupStudent, getPublicSubjects, getPublicSections } from '../services/studentService.js';
import StudentDashboard from '../components/StudentDashboard.jsx';
import './StudentLookup.css';

export default function StudentLookup() {
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [form, setForm] = useState({ section: '', surname: '', studentNo: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getPublicSubjects().then((data) => {
      setSubjects(data);
    });
    getPublicSections().then((data) => {
      setSections(data);
    });
  }, []);

  const handleSubjectChange = (e) => {
    const subjId = e.target.value;
    setSelectedSubjectId(subjId);
    getPublicSections(subjId || null).then((data) => {
      setSections(data);
    });
  };

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.section.trim() || !form.surname.trim()) {
      setError('Section and Surname are required.');
      return;
    }

    setLoading(true);
    setResult(null);
    setError('');

    const res = await lookupStudent(
      form.section,
      form.surname,
      form.studentNo,
      selectedSubjectId || null
    );
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      // Apply the admin's theme for student-side display
      if (res.adminTheme) {
        document.documentElement.setAttribute('data-theme', res.adminTheme);
      }
      setResult(res);
    }
  };

  const handleReset = () => {
    setResult(null);
    setForm({ section: '', surname: '', studentNo: '' });
    setError('');
    // Reset theme to default when returning to lookup
    document.documentElement.removeAttribute('data-theme');
  };

  if (result) {
    return (
      <StudentDashboard
        student={result.student}
        activities={result.activities}
        scores={result.scores}
        appeals={result.appeals}
        makeupRequests={result.makeupRequests}
        onBack={handleReset}
      />
    );
  }

  return (
    <div className="page-center lookup-page">
      <div className="lookup-bg-blob lookup-bg-blob--1" aria-hidden="true" />
      <div className="lookup-bg-blob lookup-bg-blob--2" aria-hidden="true" />

      <div className="lookup-card card">
        {/* Logo / Heading */}
        <div className="lookup-hero text-center">
          <div className="lookup-icon" aria-hidden="true">📋</div>
          <h1 className="lookup-title">Activity Checker</h1>
          <p className="lookup-subtitle">
            Enter your details below to view your activity scores and status.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="lookup-form" noValidate>
          {subjects.length > 0 && (
            <div className="form-group">
              <label htmlFor="subject-select" className="form-label">
                Course / Subject <span className="text-muted">(Optional)</span>
              </label>
              <select
                id="subject-select"
                className="form-input"
                value={selectedSubjectId}
                onChange={handleSubjectChange}
              >
                <option value="">-- All Courses / General --</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code}: {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="section" className="form-label">Section</label>
            {sections.length > 0 ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="section"
                  name="section"
                  type="text"
                  className="form-input"
                  placeholder="e.g. BSIT-3A"
                  value={form.section}
                  onChange={handleChange}
                  list="sections-datalist"
                  autoComplete="off"
                  autoCapitalize="characters"
                  required
                />
                <datalist id="sections-datalist">
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.name} />
                  ))}
                </datalist>
              </div>
            ) : (
              <input
                id="section"
                name="section"
                type="text"
                className="form-input"
                placeholder="e.g. BSIT-3A"
                value={form.section}
                onChange={handleChange}
                autoComplete="off"
                autoCapitalize="characters"
                required
              />
            )}
          </div>

          <div className="form-group">
            <label htmlFor="surname" className="form-label">Surname</label>
            <input
              id="surname"
              name="surname"
              type="text"
              className="form-input"
              placeholder="e.g. GARCIA"
              value={form.surname}
              onChange={handleChange}
              autoComplete="family-name"
              autoCapitalize="characters"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="studentNo" className="form-label">
              Student Number <span className="text-muted">(optional)</span>
            </label>
            <input
              id="studentNo"
              name="studentNo"
              type="text"
              className="form-input"
              placeholder="e.g. 212324"
              value={form.studentNo}
              onChange={handleChange}
              autoComplete="off"
            />
            <p className="text-muted" style={{ fontSize: '0.78rem' }}>
              Leave blank if you have no student number on record.
            </p>
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              <span aria-hidden="true">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            id="lookup-submit-btn"
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                Looking up…
              </>
            ) : (
              <>🔍 Check My Activities</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
