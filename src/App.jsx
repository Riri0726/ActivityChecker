import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import StudentLookup from './pages/StudentLookup.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

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
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
