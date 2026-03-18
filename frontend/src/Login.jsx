import { useState, useEffect, useRef } from 'react';
import logo from './assets/fayz_logo.svg';

const BACKEND_URL = 'http://localhost:8000';

/* ─── tiny inline SVG icons so we have ZERO extra deps ─── */
const EyeIcon = ({ open }) =>
  open ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.956 9.956 0 012.223-3.592M6.5 6.5A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a10.012 10.012 0 01-4.117 5.317M15 12a3 3 0 00-3-3m0 0a3 3 0 00-2.121.879M3 3l18 18" />
    </svg>
  );

const EmailIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

/* ─── Input Field ─── */
function Field({ label, id, type, value, onChange, icon, error, suffix }) {
  return (
    <div>
      <label htmlFor={id} style={{
        display: 'block',
        marginBottom: '6px',
        fontSize: '13px',
        fontWeight: '600',
        color: '#4B5563',
        letterSpacing: '0.025em'
      }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: '14px', top: '50%',
          transform: 'translateY(-50%)', color: '#EA5E28', display: 'flex', alignItems: 'center'
        }}>
          {icon}
        </span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          autoComplete={type === 'password' ? 'current-password' : 'email'}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: suffix ? '13px 48px 13px 44px' : '13px 14px 13px 44px',
            fontSize: '14px',
            border: error ? '1.5px solid #EF4444' : '1.5px solid #E5E7EB',
            borderRadius: '14px',
            background: 'rgba(255,255,255,0.7)',
            color: '#111827',
            outline: 'none',
            transition: 'all 0.25s',
            fontFamily: 'inherit',
          }}
          onFocus={e => {
            e.target.style.borderColor = '#EA5E28';
            e.target.style.boxShadow = '0 0 0 4px rgba(234,94,40,0.1)';
            e.target.style.background = '#fff';
          }}
          onBlur={e => {
            e.target.style.borderColor = error ? '#EF4444' : '#E5E7EB';
            e.target.style.boxShadow = 'none';
          }}
        />
        {suffix && (
          <button
            type="button"
            onClick={suffix.onClick}
            style={{
              position: 'absolute', right: '14px', top: '50%',
              transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9CA3AF', padding: '2px', display: 'flex', alignItems: 'center',
              transition: 'color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#EA5E28'}
            onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}
          >
            {suffix.icon}
          </button>
        )}
      </div>
      {error && (
        <p style={{ margin: '5px 0 0 4px', fontSize: '12px', color: '#EF4444', fontWeight: '500' }}>
          {error}
        </p>
      )}
    </div>
  );
}

/* ─── Main Login Component ─── */
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 50); }, []);

  const validate = () => {
    const errs = {};
    if (!email.trim()) errs.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email address.';
    if (!password) errs.password = 'Password is required.';
    else if (password.length < 6) errs.password = 'Password must be at least 6 characters.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/login/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        // Store business name for the dashboard greeting
        if (data.user.business_name) {
          sessionStorage.setItem('business_name', data.user.business_name);
        }
        // Redirect based on user type (superuser → /, business user → /business-dashboard)
        window.location.href = data.user.redirect || '/';
      } else {
        setServerError(data.error || 'Login failed. Please try again.');
      }
    } catch {
      setServerError('Cannot connect to server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Styles ── */
  const card = {
    background: 'rgba(255,255,255,0.72)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '32px',
    border: '1px solid rgba(255,255,255,0.5)',
    boxShadow: '0 32px 64px rgba(0,0,0,0.10), 0 4px 20px rgba(234,94,40,0.06)',
    padding: '52px 48px',
    width: '100%',
    maxWidth: '440px',
  };

  const page = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '"Google Sans", system-ui, sans-serif',
    position: 'relative',
    overflow: 'hidden',
    background: 'linear-gradient(135deg, #fff8f5 0%, #f0f4f8 50%, #fff8f5 100%)',
  };

  return (
    <div style={page}>
      {/* Background blobs */}
      <div style={{
        position: 'absolute', width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(234,94,40,0.15) 0%, transparent 70%)',
        top: '-150px', right: '-150px', animation: 'pulse 4s ease-in-out infinite'
      }} />
      <div style={{
        position: 'absolute', width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(234,94,40,0.08) 0%, transparent 70%)',
        bottom: '-120px', left: '-120px', animation: 'pulse 5s ease-in-out infinite 1s'
      }} />

      {/* Card */}
      <div style={{
        ...card,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <img
            src={logo}
            alt="Fayz Soft"
            style={{ height: '72px', marginBottom: '20px', filter: 'drop-shadow(0 4px 12px rgba(234,94,40,0.2))' }}
          />
          <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: '700', color: '#111827', letterSpacing: '-0.5px' }}>
            Welcome back
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
            Sign in to the POS Admin Dashboard
          </p>
        </div>

        {/* Server Error */}
        {serverError && (
          <div style={{
            background: 'rgba(254,226,226,0.8)', border: '1px solid #FECACA',
            borderRadius: '12px', padding: '12px 16px', marginBottom: '24px',
            color: '#DC2626', fontSize: '13.5px', fontWeight: '500',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <span style={{ fontSize: '16px' }}>⚠</span> {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Field
              label="Email Address"
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              icon={<EmailIcon />}
              error={errors.email}
            />
            <Field
              label="Password"
              id="password"
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              icon={<LockIcon />}
              error={errors.password}
              suffix={{
                icon: <EyeIcon open={showPwd} />,
                onClick: () => setShowPwd(v => !v)
              }}
            />

            {/* Forgot */}
            <div style={{ textAlign: 'right', marginTop: '-8px' }}>
              <button type="button" style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#EA5E28', fontSize: '13px', fontWeight: '600',
                fontFamily: 'inherit', padding: 0
              }}>
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '15px',
                marginTop: '4px',
                background: loading
                  ? 'rgba(234,94,40,0.7)'
                  : 'linear-gradient(135deg, #EA5E28 0%, #ff7843 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '16px',
                fontSize: '15px',
                fontWeight: '700',
                fontFamily: 'inherit',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 8px 24px rgba(234,94,40,0.35)',
                transition: 'all 0.25s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {loading ? <><SpinnerIcon /> Authenticating…</> : 'Sign In'}
            </button>
          </div>
        </form>

        <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '12px', color: '#9CA3AF', fontWeight: '500' }}>
          © {new Date().getFullYear()} Fayz Soft. All rights reserved.
        </p>
      </div>

      <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.05);opacity:1}}`}</style>
    </div>
  );
}
