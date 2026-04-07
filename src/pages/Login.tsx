import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import '../Auth.css';

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

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!username.trim()) e.username = 'Username is required';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setAlert(null);

    try {
      // Convert username → internal email
      const fakeEmail = `${username.trim().toLowerCase()}@worklog.app`;

      const { error } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password,
      });

      if (error) throw error;
      // App.tsx onAuthStateChange handles redirect
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Login failed';
      const msg = raw.includes('Invalid login credentials')
        ? 'Incorrect username or password'
        : raw;
      setAlert({ type: 'error', msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">📋</div>
          <span className="auth-app-name">WorkLog</span>
        </div>

        <div className="auth-heading">
          <h1>Welcome back</h1>
          <p>Sign in with your username and password</p>
        </div>

        {alert && (
          <div className={`auth-alert ${alert.type}`} style={{ marginBottom: 16 }}>
            {alert.type === 'error' ? '⚠️' : '✅'} {alert.msg}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label className="auth-label">Username</label>
            <input
              className={`auth-input${errors.username ? ' error' : ''}`}
              type="text"
              placeholder="e.g. john_doe"
              value={username}
              autoComplete="username"
              onChange={e => { setUsername(e.target.value); setErrors(v => ({ ...v, username: '' })); setAlert(null); }}
            />
            {errors.username && <span className="field-error">{errors.username}</span>}
          </div>

          <div className="auth-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="auth-label">Password</label>
              <button type="button" className="auth-link" style={{ fontSize: 12 }}
                onClick={() => navigate('/forgot-password')}>
                Forgot password?
              </button>
            </div>
            <div className="auth-input-wrap">
              <input
                className={`auth-input has-icon${errors.password ? ' error' : ''}`}
                type={showPwd ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                autoComplete="current-password"
                onChange={e => { setPassword(e.target.value); setErrors(v => ({ ...v, password: '' })); setAlert(null); }}
              />
              <button type="button" className="eye-btn" onClick={() => setShowPwd(v => !v)}>
                {showPwd ? <EyeOff /> : <EyeOn />}
              </button>
            </div>
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? <><div className="spinner" /> Signing in…</> : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?{' '}
          <button className="auth-link" onClick={() => navigate('/register')}>Create account</button>
        </div>
      </div>
    </div>
  );
}
