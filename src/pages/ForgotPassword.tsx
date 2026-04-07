import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import '../Auth.css';

type Step = 'request' | 'otp' | 'reset';

const EyeOn = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOff = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const getStrength = (pwd: string): number => {
  if (pwd.length === 0) return 0;
  if (pwd.length < 8) return 1;
  let score = 1;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
};
const strengthMeta = [null,
  { label: 'Weak', cls: 's1' }, { label: 'Fair', cls: 's2' },
  { label: 'Good', cls: 's3' }, { label: 'Strong', cls: 's4' },
];

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [emailError, setEmailError] = useState('');
  const [pwdErrors, setPwdErrors] = useState<{ pwd?: string; confirm?: string }>({});
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Step 1: Send OTP email ──────────────────────────
  const handleSendOtp = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!email.trim()) { setEmailError('Email is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Enter a valid email'); return; }
    setLoading(true);
    setAlert(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/forgot-password',
      });
      if (error) throw error;
      setAlert({ type: 'success', msg: `OTP sent to ${email}. Check your inbox.` });
      setStep('otp');
    } catch (err: unknown) {
      setAlert({ type: 'error', msg: err instanceof Error ? err.message : 'Failed to send OTP' });
    } finally {
      setLoading(false);
    }
  };

  // ── OTP input handling ──────────────────────────────
  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  const handleVerifyOtp = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const code = otp.join('');
    if (code.length < 6) { setAlert({ type: 'error', msg: 'Enter all 6 digits' }); return; }
    setLoading(true);
    setAlert(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'recovery' });
      if (error) throw error;
      setStep('reset');
      setAlert(null);
    } catch (err: unknown) {
      setAlert({ type: 'error', msg: err instanceof Error ? err.message : 'Invalid OTP' });
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Set new password ────────────────────────
  const handleResetPassword = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: typeof pwdErrors = {};
    if (!newPwd) e.pwd = 'Password is required';
    else if (newPwd.length < 8) e.pwd = 'Minimum 8 characters';
    if (!confirmPwd) e.confirm = 'Please confirm your password';
    else if (newPwd !== confirmPwd) e.confirm = 'Passwords do not match';
    setPwdErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    setAlert(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      setAlert({ type: 'success', msg: 'Password updated! Redirecting to login…' });
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: unknown) {
      setAlert({ type: 'error', msg: err instanceof Error ? err.message : 'Failed to update password' });
    } finally {
      setLoading(false);
    }
  };

  const strength = getStrength(newPwd);
  const sm = strengthMeta[strength];

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand */}
        <div className="auth-brand">
          <div className="auth-logo">📋</div>
          <span className="auth-app-name">WorkLog</span>
        </div>

        {/* Step indicator */}
        <div className="auth-steps">
          {(['request', 'otp', 'reset'] as Step[]).map((s, idx) => {
            const stepNum = idx + 1;
            const isDone = ['request', 'otp', 'reset'].indexOf(step) > idx;
            const isActive = step === s;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                <div className={`auth-step${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}>
                  <div className={`step-circle${isDone ? ' done' : isActive ? ' active' : ''}`}>
                    {isDone ? '✓' : stepNum}
                  </div>
                  <span>{s === 'request' ? 'Email' : s === 'otp' ? 'Verify' : 'Reset'}</span>
                </div>
                {idx < 2 && <div className={`step-line${isDone ? ' done' : ''}`} />}
              </div>
            );
          })}
        </div>

        {/* ── Step 1: Email ── */}
        {step === 'request' && (
          <>
            <div className="auth-heading">
              <h1>Forgot password?</h1>
              <p>Enter your email — we'll send a 6-digit OTP</p>
            </div>
            {alert && <div className={`auth-alert ${alert.type}`} style={{ marginBottom: 16 }}>{alert.type === 'error' ? '⚠️' : '✅'} {alert.msg}</div>}
            <form className="auth-form" onSubmit={handleSendOtp} noValidate>
              <div className="auth-field">
                <label className="auth-label">Email address</label>
                <input className={`auth-input${emailError ? ' error' : ''}`}
                  type="email" placeholder="john@example.com"
                  value={email} onChange={e => { setEmail(e.target.value); setEmailError(''); }} />
                {emailError && <span className="field-error">{emailError}</span>}
              </div>
              <button className="auth-btn" type="submit" disabled={loading}>
                {loading ? <><div className="spinner" /> Sending OTP…</> : 'Send OTP'}
              </button>
            </form>
          </>
        )}

        {/* ── Step 2: OTP ── */}
        {step === 'otp' && (
          <>
            <div className="auth-heading">
              <h1>Enter OTP</h1>
              <p>6-digit code sent to <strong>{email}</strong></p>
            </div>
            {alert && <div className={`auth-alert ${alert.type}`} style={{ marginBottom: 16 }}>{alert.type === 'error' ? '⚠️' : '✅'} {alert.msg}</div>}
            <form className="auth-form" onSubmit={handleVerifyOtp}>
              <div className="otp-wrap">
                {otp.map((digit, i) => (
                  <input key={i} className="otp-input" type="text" inputMode="numeric"
                    maxLength={1} value={digit}
                    ref={el => { otpRefs.current[i] = el; }}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKey(i, e)} />
                ))}
              </div>
              <button className="auth-btn" type="submit" disabled={loading}>
                {loading ? <><div className="spinner" /> Verifying…</> : 'Verify OTP'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button type="button" className="auth-link" onClick={() => { setStep('request'); setOtp(['','','','','','']); setAlert(null); }}>
                  ← Change email / Resend
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── Step 3: New password ── */}
        {step === 'reset' && (
          <>
            <div className="auth-heading">
              <h1>Set new password</h1>
              <p>Choose a strong password for your account</p>
            </div>
            {alert && <div className={`auth-alert ${alert.type}`} style={{ marginBottom: 16 }}>{alert.type === 'error' ? '⚠️' : '✅'} {alert.msg}</div>}
            <form className="auth-form" onSubmit={handleResetPassword} noValidate>
              <div className="auth-field">
                <label className="auth-label">New Password</label>
                <div className="auth-input-wrap">
                  <input className={`auth-input has-icon${pwdErrors.pwd ? ' error' : ''}`}
                    type={showPwd ? 'text' : 'password'} placeholder="Min. 8 characters"
                    value={newPwd} onChange={e => { setNewPwd(e.target.value); setPwdErrors(v => ({ ...v, pwd: '' })); }} />
                  <button type="button" className="eye-btn" onClick={() => setShowPwd(v => !v)}>
                    {showPwd ? <EyeOff /> : <EyeOn />}
                  </button>
                </div>
                {newPwd.length > 0 && (
                  <div className="strength-bar-wrap">
                    <div className="strength-bars">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`strength-seg${strength >= i ? ` active-${strength}` : ''}`} />
                      ))}
                    </div>
                    {sm && <span className={`strength-label ${sm.cls}`}>{sm.label} password</span>}
                  </div>
                )}
                {pwdErrors.pwd && <span className="field-error">{pwdErrors.pwd}</span>}
              </div>

              <div className="auth-field">
                <label className="auth-label">Confirm Password</label>
                <div className="auth-input-wrap">
                  <input className={`auth-input has-icon${pwdErrors.confirm ? ' error' : ''}`}
                    type={showConfirm ? 'text' : 'password'} placeholder="Re-enter password"
                    value={confirmPwd} onChange={e => { setConfirmPwd(e.target.value); setPwdErrors(v => ({ ...v, confirm: '' })); }} />
                  <button type="button" className="eye-btn" onClick={() => setShowConfirm(v => !v)}>
                    {showConfirm ? <EyeOff /> : <EyeOn />}
                  </button>
                </div>
                {pwdErrors.confirm && <span className="field-error">{pwdErrors.confirm}</span>}
              </div>

              <button className="auth-btn" type="submit" disabled={loading}>
                {loading ? <><div className="spinner" /> Updating…</> : 'Update Password'}
              </button>
            </form>
          </>
        )}

        <div className="auth-footer">
          Remember your password?{' '}
          <button className="auth-link" onClick={() => navigate('/login')}>Sign in</button>
        </div>
      </div>
    </div>
  );
}
