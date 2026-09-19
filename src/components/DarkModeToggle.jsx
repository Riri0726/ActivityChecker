import { useDarkMode } from '../context/DarkModeContext.jsx';
import './DarkModeToggle.css';

/**
 * DarkModeToggle
 * Props:
 * - variant: 'floating' | 'header' | 'switch' (default: 'floating')
 * - showLabel: boolean (default: true)
 */
export default function DarkModeToggle({ variant = 'floating', showLabel = true }) {
  const { isDark, toggleDarkMode } = useDarkMode();

  if (variant === 'switch') {
    return (
      <div className="dark-mode-sidebar-row">
        <span className="dark-mode-sidebar-label">
          <span>{isDark ? '🌙' : '☀️'}</span>
          <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
        </span>
        <button
          id="admin-dark-mode-toggle"
          type="button"
          className={`dark-mode-switch ${isDark ? 'active' : ''}`}
          onClick={toggleDarkMode}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
          aria-label={`Toggle dark mode, currently ${isDark ? 'dark' : 'light'}`}
        >
          <span className="dark-mode-switch-thumb" />
        </button>
      </div>
    );
  }

  if (variant === 'header') {
    return (
      <button
        id="header-dark-mode-toggle"
        type="button"
        className="dark-mode-header-btn"
        onClick={toggleDarkMode}
        title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        aria-label={`Toggle dark mode, currently ${isDark ? 'dark' : 'light'}`}
      >
        <span className="dark-mode-icon">{isDark ? '☀️' : '🌙'}</span>
        {showLabel && <span>{isDark ? 'Light' : 'Dark'}</span>}
      </button>
    );
  }

  // Default: Floating button in top-right corner
  return (
    <button
      id="floating-dark-mode-toggle"
      type="button"
      className="dark-mode-floating-btn"
      onClick={toggleDarkMode}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
      aria-label={`Toggle dark mode, currently ${isDark ? 'dark' : 'light'}`}
    >
      <span className="dark-mode-icon">{isDark ? '☀️' : '🌙'}</span>
      {showLabel && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
    </button>
  );
}
