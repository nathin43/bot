import { useEffect } from 'react';
import './LogoutTransition.css';

/**
 * LogoutTransition Component
 * Full-screen animated overlay for smooth logout experience
 */
const LogoutTransition = ({ isActive, onComplete }) => {
  useEffect(() => {
    if (isActive) {
      // Prevent scrolling during animation
      document.body.style.overflow = 'hidden';
      
      // Complete animation after duration
      const timer = setTimeout(() => {
        onComplete();
        document.body.style.overflow = '';
      }, 1200); // Match animation duration

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';
      };
    }
  }, [isActive, onComplete]);

  if (!isActive) return null;

  return (
    <div className="logout-transition-overlay">
      {/* Animated Background Elements */}
      <div className="logout-animated-bg">
        <div className="logout-gradient-orb orb-1"></div>
        <div className="logout-gradient-orb orb-2"></div>
        <div className="logout-gradient-orb orb-3"></div>
      </div>

      {/* Floating Particles */}
      <div className="logout-particles">
        {[...Array(15)].map((_, i) => (
          <div key={i} className={`logout-particle particle-${i + 1}`}></div>
        ))}
      </div>

      {/* Electric Pulse Ring */}
      <div className="logout-pulse-container">
        <div className="logout-pulse-ring ring-1"></div>
        <div className="logout-pulse-ring ring-2"></div>
        <div className="logout-pulse-ring ring-3"></div>
        <div className="logout-pulse-ring ring-4"></div>
      </div>

      {/* Content */}
      <div className="logout-content">
        <div className="logout-icon-wrapper">
          <div className="logout-icon">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </div>
        </div>
        <h2 className="logout-text">Logging out...</h2>
        <div className="logout-spinner">
          <div className="spinner-circle"></div>
        </div>
      </div>
    </div>
  );
};

export default LogoutTransition;
