import React, { Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { DarkModeProvider } from './context/DarkModeContext.jsx';
import StudentLookup from './pages/StudentLookup.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f9fafb' }}>
          <div style={{ padding: '2rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', textAlign: 'center', maxWidth: '400px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ margin: '0 0 1rem 0', color: '#111827' }}>Something went wrong</h2>
            <p style={{ color: '#ef4444', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              {this.state.error && this.state.error.toString()}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                onClick={() => { window.location.reload(); }}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
              >
                Reload Page
              </button>
              <button 
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/';
                }}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Protected route — redirects to /admin if not authenticated
function ProtectedRoute({ children }) {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="page-center">
        <div className="loading-center">
          <div className="spinner" />
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  return session ? children : <Navigate to="/admin" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Student lookup (public) */}
      <Route path="/" element={<StudentLookup />} />

      {/* Admin login */}
      <Route path="/admin" element={<AdminLogin />} />

      {/* Admin dashboard (protected) */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <DarkModeProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </DarkModeProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
