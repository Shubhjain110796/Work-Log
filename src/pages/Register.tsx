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

const getStrength = (pwd: string) => {
  if (!pwd) return 0;
  if (pwd.length < 8) return 1;
  let s = 1;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return s;
};
const strengthMeta = [null,
  { label: 'Weak', cls: 's1' }, { label: 'Fair', cls: 's2' },
  { label: 'Good', cls: 's3' }, { label: 'Strong', cls: 's4' },
];

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!username.trim()) e.username = 'Username is required';
    else if (username.length < 3) e.username = 'At least 3 characters';
    else if (!/^[a-zA-Z0-9_]+$/.test(username)) e.username = 'Only letters, numbers, underscore';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Minimum 8 characters';
    if (!confirm) e.confirm = 'Please confirm your password';
    else if (password !== confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setAlert(null);

    // Use username@worklog.app as internal email — user never sees this
    const fakeEmail = `${username.trim().toLowerCase()}@worklog.app`;

    try {
      // Check username not taken
      const { data: existing } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.trim().toLowerCase())
        .single();

      if (existing) {
        setErrors({ username: 'Username already taken' });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: fakeEmail,
        password,
      });
      if (error) throw error;

      if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          username: username.trim().toLowerCase(),
          email: fakeEmail,
        });
      }

      setAlert({ type: 'success', msg: 'Account created! Redirecting to login…' });
      setTimeout(() => navigate('/login'), 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setAlert({ type: 'error', msg });
    } finally {
      setLoading(false);
    }
  };

  const strength = getStrength(password);
  const sm = strengthMeta[strength];

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">📋</div>
          <span className="auth-app-name">WorkLog</span>
        </div>

        <div className="auth-heading">
          <h1>Create account</h1>
          <p>Choose a username and password</p>
        </div>

        {alert && (
          <div className={`auth-alert ${alert.type}`} style={{ marginBottom: 16 }}>
            {alert.type === 'error' ? '⚠️' : '✅'} {alert.msg}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* Username */}
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

          {/* Password */}
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <div className="auth-input-wrap">
              <input
                className={`auth-input has-icon${errors.password ? ' error' : ''}`}
                type={showPwd ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={password}
                autoComplete="new-password"
                onChange={e => { setPassword(e.target.value); setErrors(v => ({ ...v, password: '' })); }}
              />
              <button type="button" className="eye-btn" onClick={() => setShowPwd(v => !v)}>
                {showPwd ? <EyeOff /> : <EyeOn />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="strength-bar-wrap">
                <div className="strength-bars">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`strength-seg${strength >= i ? ` active-${strength}` : ''}`} />
                  ))}
                </div>
                {sm && <span className={`strength-label ${sm.cls}`}>{sm.label} password</span>}
              </div>
            )}
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>

          {/* Confirm Password */}
          <div className="auth-field">
            <label className="auth-label">Confirm Password</label>
            <div className="auth-input-wrap">
              <input
                className={`auth-input has-icon${errors.confirm ? ' error' : ''}`}
                type={showConfirm ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={confirm}
                autoComplete="new-password"
                onChange={e => { setConfirm(e.target.value); setErrors(v => ({ ...v, confirm: '' })); }}
              />
              <button type="button" className="eye-btn" onClick={() => setShowConfirm(v => !v)}>
                {showConfirm ? <EyeOff /> : <EyeOn />}
              </button>
            </div>
            {errors.confirm && <span className="field-error">{errors.confirm}</span>}
          </div>

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? <><div className="spinner" /> Creating account…</> : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <button className="auth-link" onClick={() => navigate('/login')}>Sign in</button>
        </div>
      </div>
    </div>
  );
}
