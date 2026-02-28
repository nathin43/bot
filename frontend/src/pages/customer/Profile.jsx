import { useState, useContext, useMemo } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { AuthContext } from '../../context/AuthContext';
import API from '../../services/api';
import './Profile.css';

const getInitials = (name) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const levels = [
    { label: 'Weak', color: '#ef4444' },
    { label: 'Fair', color: '#f97316' },
    { label: 'Good', color: '#eab308' },
    { label: 'Strong', color: '#22c55e' },
    { label: 'Very Strong', color: '#16a34a' },
  ];
  return { score, ...levels[score] };
};

const Profile = () => {
  const { user, logout } = useContext(AuthContext);
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [updatingPw, setUpdatingPw] = useState(false);

  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    street: user?.address?.street || '',
    city: user?.address?.city || '',
    state: user?.address?.state || '',
    zipCode: user?.address?.zipCode || '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [toast, setToast] = useState({ show: false, type: '', text: '' });

  const showToast = (type, text) => {
    setToast({ show: true, type, text });
    setTimeout(() => setToast({ show: false, type: '', text: '' }), 4000);
  };

  const passwordStrength = useMemo(() => getPasswordStrength(passwordData.newPassword), [passwordData.newPassword]);

  const handleProfileChange = (e) => setProfileData({ ...profileData, [e.target.name]: e.target.value });
  const handlePasswordChange = (e) => setPasswordData({ ...passwordData, [e.target.name]: e.target.value });

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updateData = {
        name: profileData.name,
        phone: profileData.phone,
        address: {
          street: profileData.street,
          city: profileData.city,
          state: profileData.state,
          zipCode: profileData.zipCode,
          country: 'India',
        },
      };
      await API.put('/users/profile', updateData);
      showToast('success', 'Profile updated successfully!');
      setEditing(false);
      localStorage.setItem('user', JSON.stringify({ ...user, ...updateData }));
    } catch (error) {
      showToast('error', error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast('error', 'Passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      showToast('error', 'Password must be at least 6 characters');
      return;
    }
    setUpdatingPw(true);
    try {
      await API.put('/users/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      showToast('success', 'Password updated successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setChangingPassword(false);
    } catch (error) {
      showToast('error', error.response?.data?.message || 'Failed to update password');
    } finally {
      setUpdatingPw(false);
    }
  };

  const toggleShow = (field) => setShowPasswords(p => ({ ...p, [field]: !p[field] }));

  const infoFields = [
    { icon: '👤', label: 'Full Name', value: user?.name },
    { icon: '✉️', label: 'Email Address', value: user?.email },
    { icon: '📱', label: 'Phone Number', value: user?.phone || '—' },
    { icon: '📍', label: 'Street', value: user?.address?.street || '—' },
    { icon: '🏙️', label: 'City', value: user?.address?.city || '—' },
    { icon: '🗺️', label: 'State', value: user?.address?.state || '—' },
    { icon: '📮', label: 'PIN Code', value: user?.address?.zipCode || '—' },
    { icon: '🇮🇳', label: 'Country', value: 'India' },
  ];

  return (
    <>
      <Navbar />

      {/* Toast Notification */}
      {toast.show && (
        <div className={`pf-toast pf-toast--${toast.type}`}>
          <span className="pf-toast__icon">{toast.type === 'success' ? '✓' : '✕'}</span>
          {toast.text}
        </div>
      )}

      <div className="pf-page">

        {/* ── Hero Banner (matches site hero style) ── */}
        <div className="pf-hero">
          {/* Floating orbs — same as Home hero */}
          <div className="pf-hero__orb pf-hero__orb--1" />
          <div className="pf-hero__orb pf-hero__orb--2" />
          <div className="pf-hero__orb pf-hero__orb--3" />
          <div className="pf-hero__grid-overlay" />
          <div className="pf-hero__content">
            <div className="pf-avatar">
              {getInitials(user?.name)}
              <span className="pf-avatar__ring" />
            </div>
            <div className="pf-hero__text">
              <h1 className="pf-hero__name">{user?.name || 'User'}</h1>
              <p className="pf-hero__email">{user?.email}</p>
              <span className="pf-hero__badge">
                <span className="pf-hero__badge-dot" />
                Active Account
              </span>
            </div>
            {!editing && (
              <button className="pf-hero__edit-btn" onClick={() => setEditing(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit Profile
              </button>
            )}
          </div>
        </div>

        <div className="pf-body">

          {/* ── Profile Info ── */}
          <section className="pf-section">
            <div className="pf-section__header">
              <div className="pf-section__icon-wrap">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div>
                <h2 className="pf-section__title">Profile Information</h2>
                <p className="pf-section__sub">Your personal details and contact information</p>
              </div>
            </div>

            {editing ? (
              <form className="pf-form" onSubmit={handleProfileSubmit}>
                <div className="pf-form__grid">
                  <div className="pf-field">
                    <label className="pf-field__label">Full Name</label>
                    <input className="pf-field__input" type="text" name="name" value={profileData.name} onChange={handleProfileChange} required placeholder="Your full name" />
                  </div>
                  <div className="pf-field">
                    <label className="pf-field__label">Email Address</label>
                    <input className="pf-field__input pf-field__input--disabled" type="email" value={user?.email} disabled />
                    <span className="pf-field__hint">Email cannot be changed</span>
                  </div>
                  <div className="pf-field">
                    <label className="pf-field__label">Phone Number</label>
                    <input className="pf-field__input" type="tel" name="phone" value={profileData.phone} onChange={handleProfileChange} required pattern="[0-9]{10}" placeholder="10-digit mobile number" />
                  </div>
                  <div className="pf-field pf-field--full">
                    <label className="pf-field__label">Street Address</label>
                    <input className="pf-field__input" type="text" name="street" value={profileData.street} onChange={handleProfileChange} required placeholder="House / Building / Street" />
                  </div>
                  <div className="pf-field">
                    <label className="pf-field__label">City</label>
                    <input className="pf-field__input" type="text" name="city" value={profileData.city} onChange={handleProfileChange} required placeholder="City" />
                  </div>
                  <div className="pf-field">
                    <label className="pf-field__label">State</label>
                    <input className="pf-field__input" type="text" name="state" value={profileData.state} onChange={handleProfileChange} required placeholder="State" />
                  </div>
                  <div className="pf-field">
                    <label className="pf-field__label">PIN Code</label>
                    <input className="pf-field__input" type="text" name="zipCode" value={profileData.zipCode} onChange={handleProfileChange} required pattern="[0-9]{6}" placeholder="6-digit PIN" />
                  </div>
                </div>
                <div className="pf-form__actions">
                  <button type="submit" className="pf-btn pf-btn--primary" disabled={saving}>
                    {saving ? <span className="pf-btn__spinner" /> : null}
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button type="button" className="pf-btn pf-btn--ghost" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </form>
            ) : (
              <div className="pf-info-grid">
                {infoFields.map((f, i) => (
                  <div className="pf-info-card" key={i} style={{ animationDelay: `${i * 0.06}s` }}>
                    <div className="pf-info-card__icon">{f.icon}</div>
                    <div className="pf-info-card__body">
                      <span className="pf-info-card__label">{f.label}</span>
                      <span className="pf-info-card__value">{f.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Change Password ── */}
          <section className="pf-section">
            <div className="pf-section__header pf-section__header--dark">
              <div className="pf-section__icon-wrap pf-section__icon-wrap--dark">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <div>
                <h2 className="pf-section__title">Security &amp; Password</h2>
                <p className="pf-section__sub">Keep your account secure with a strong password</p>
              </div>
              {!changingPassword && (
                <button className="pf-btn pf-btn--outline-white pf-btn--sm" onClick={() => setChangingPassword(true)}>
                  Change Password
                </button>
              )}
            </div>

            {changingPassword && (
              <form className="pf-form" onSubmit={handlePasswordSubmit}>
                <div className="pf-form__grid pf-form__grid--narrow">
                  <div className="pf-field pf-field--full">
                    <label className="pf-field__label">Current Password</label>
                    <div className="pf-field__pw-wrap">
                      <input className="pf-field__input" type={showPasswords.current ? 'text' : 'password'} name="currentPassword" value={passwordData.currentPassword} onChange={handlePasswordChange} required minLength={6} placeholder="Enter current password" />
                      <button type="button" className="pf-field__pw-toggle" onClick={() => toggleShow('current')} tabIndex={-1}>
                        {showPasswords.current ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                  <div className="pf-field pf-field--full">
                    <label className="pf-field__label">New Password</label>
                    <div className="pf-field__pw-wrap">
                      <input className="pf-field__input" type={showPasswords.new ? 'text' : 'password'} name="newPassword" value={passwordData.newPassword} onChange={handlePasswordChange} required minLength={6} placeholder="Enter new password" />
                      <button type="button" className="pf-field__pw-toggle" onClick={() => toggleShow('new')} tabIndex={-1}>
                        {showPasswords.new ? '🙈' : '👁️'}
                      </button>
                    </div>
                    {passwordData.newPassword && (
                      <div className="pf-strength">
                        <div className="pf-strength__bar">
                          {[0,1,2,3].map(i => (
                            <div key={i} className="pf-strength__seg" style={{ background: i < passwordStrength.score ? passwordStrength.color : '#e5e7eb' }} />
                          ))}
                        </div>
                        <span className="pf-strength__label" style={{ color: passwordStrength.color }}>{passwordStrength.label}</span>
                      </div>
                    )}
                  </div>
                  <div className="pf-field pf-field--full">
                    <label className="pf-field__label">Confirm New Password</label>
                    <div className="pf-field__pw-wrap">
                      <input className="pf-field__input" type={showPasswords.confirm ? 'text' : 'password'} name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordChange} required minLength={6} placeholder="Re-enter new password" />
                      <button type="button" className="pf-field__pw-toggle" onClick={() => toggleShow('confirm')} tabIndex={-1}>
                        {showPasswords.confirm ? '🙈' : '👁️'}
                      </button>
                    </div>
                    {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                      <span className="pf-field__error">Passwords do not match</span>
                    )}
                  </div>
                </div>
                <div className="pf-form__actions">
                  <button type="submit" className="pf-btn pf-btn--primary" disabled={updatingPw}>
                    {updatingPw ? <span className="pf-btn__spinner" /> : null}
                    {updatingPw ? 'Updating…' : 'Update Password'}
                  </button>
                  <button type="button" className="pf-btn pf-btn--ghost" onClick={() => { setChangingPassword(false); setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' }); }}>Cancel</button>
                </div>
              </form>
            )}
          </section>

          {/* ── Account Actions ── */}
          <section className="pf-section pf-section--actions">
            <div className="pf-section__header">
              <div className="pf-section__icon-wrap pf-section__icon-wrap--danger">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div>
                <h2 className="pf-section__title">Account Actions</h2>
                <p className="pf-section__sub">Manage your session and account settings</p>
              </div>
            </div>
            <div className="pf-actions-row">
              <div className="pf-action-card">
                <div className="pf-action-card__info">
                  <span className="pf-action-card__title">Sign Out</span>
                  <span className="pf-action-card__desc">Logout from your current session on all devices</span>
                </div>
                <button className="pf-btn pf-btn--logout" onClick={logout}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Logout
                </button>
              </div>
            </div>
          </section>

        </div>
      </div>

      <Footer />
    </>
  );
};

export default Profile;
