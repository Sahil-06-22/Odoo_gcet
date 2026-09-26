// Signup Page
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ loginId: '', email: '', password: '', confirmPassword: '', role: 'WAREHOUSE_STAFF' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState('');

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.loginId || form.loginId.length < 6 || form.loginId.length > 12)
      errs.loginId = 'Login ID must be between 6–12 characters.';
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Enter a valid email address.';
    if (!form.password || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/.test(form.password))
      errs.password = 'Password must be ≥8 chars with uppercase, lowercase and a special character.';
    if (form.password !== form.confirmPassword)
      errs.confirmPassword = 'Passwords do not match.';
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError('');
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      await signup(form.loginId, form.email, form.password, form.role);
      navigate('/dashboard');
    } catch {
      setGlobalError('Email already registered. Please use a different email or sign in.');
    } finally {
      setLoading(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <div className="auth-logo">
          <div className="auth-logo-icon">SS</div>
          <div>
            <div className="auth-logo-text">StockSense</div>
            <div className="auth-logo-sub">Inventory Management</div>
          </div>
        </div>

        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Join StockSense and manage inventory with ease.</p>

        {globalError && (
          <div className="alert alert-error" role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{globalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-loginid">
              Login ID <span className="required">*</span>
            </label>
            <input
              id="signup-loginid"
              className={`input${errors.loginId ? ' error' : ''}`}
              placeholder="6–12 characters, unique"
              value={form.loginId}
              onChange={set('loginId')}
              aria-required="true"
              aria-describedby={errors.loginId ? 'loginid-error' : undefined}
            />
            {errors.loginId && <span id="loginid-error" className="form-error" role="alert"><AlertCircle size={12} />{errors.loginId}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">
              Email ID <span className="required">*</span>
            </label>
            <input
              id="signup-email"
              type="email"
              className={`input${errors.email ? ' error' : ''}`}
              placeholder="Enter your email address"
              value={form.email}
              onChange={set('email')}
              aria-required="true"
            />
            {errors.email && <span className="form-error" role="alert"><AlertCircle size={12} />{errors.email}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">
              Password <span className="required">*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="signup-password"
                type={showPass ? 'text' : 'password'}
                className={`input${errors.password ? ' error' : ''}`}
                placeholder="Min 8 chars, upper + lower + special"
                value={form.password}
                onChange={set('password')}
                style={{ paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowPass(v => !v)} aria-label="Toggle password"
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <span className="form-error" role="alert"><AlertCircle size={12} />{errors.password}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-confirm">
              Re-Enter Password <span className="required">*</span>
            </label>
            <input
              id="signup-confirm"
              type="password"
              className={`input${errors.confirmPassword ? ' error' : ''}`}
              placeholder="Confirm your password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
            />
            {errors.confirmPassword && <span className="form-error" role="alert"><AlertCircle size={12} />{errors.confirmPassword}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-role">Role</label>
            <select id="signup-role" className="input select" value={form.role} onChange={set('role')}>
              <option value="INVENTORY_MANAGER">Inventory Manager</option>
              <option value="WAREHOUSE_STAFF">Warehouse Staff</option>
            </select>
          </div>

          <button
            id="signup-submit"
            type="submit"
            className={`btn btn-primary w-full btn-lg${loading ? ' btn-loading' : ''}`}
            disabled={loading}
          >
            {loading ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
            {loading ? 'Creating account…' : 'SIGN UP'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login" id="go-login-link">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
