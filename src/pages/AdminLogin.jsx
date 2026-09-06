import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './AdminLogin.css';

export default function AdminLogin() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    try {
      await signIn(form.email, form.password);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center admin-login-page">
      <div className="admin-login-bg" aria-hidden="true" />

      <div className="admin-login-card card">
        <div className="text-center" style={{ marginBottom: 'var(--sp-8)' }}>
          <div className="admin-login-icon" aria-hidden="true">🛡️</div>
          <h1 style={{ fontSize: '1.6rem' }}>Admin Portal</h1>
          <p style={{ marginTop: 'var(--sp-2)' }}>
            Sign in with your instructor credentials
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group" style={{ marginBottom: 'var(--sp-4)' }}>
            <label htmlFor="admin-email" className="form-label">Email</label>
            <input
              id="admin-email"
              name="email"
              type="email"
              className="form-input"
              placeholder="you@school.edu"
              value={form.email}
              onChange={handleChange}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--sp-5)' }}>
            <label htmlFor="admin-password" className="form-label">Password</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 'var(--sp-4)' }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            id="admin-login-btn"
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 'var(--sp-6)', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--sp-5)' }}>
          <a href="/" className="text-muted" style={{ fontSize: '0.82rem' }}>
            ← Student lookup
          </a>
        </div>
      </div>
    </div>
  );
}
