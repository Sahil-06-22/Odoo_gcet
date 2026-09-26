// Forgot Password Page (OTP-based reset)
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, KeyRound, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

type Step = 'email' | 'otp';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return setError('Enter a valid email address.');
    }
    setLoading(true);
    await new Promise(res => setTimeout(res, 800));
    setLoading(false);
    setStep('otp');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!otp.trim()) return setError('OTP is required.');
    if (!newPassword || newPassword.length < 8) return setError('Password must be at least 8 characters.');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');

    setLoading(true);
    await new Promise(res => setTimeout(res, 1000));
    setLoading(false);
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
            <div className="kpi-icon" style={{ '--kpi-color': 'var(--color-success)', '--kpi-color-bg': 'var(--color-success-bg)', width: 64, height: 64, borderRadius: 'var(--radius-xl)', fontSize: 28 } as React.CSSProperties}>
              <CheckCircle size={28} />
            </div>
          </div>
          <h1 className="auth-title">Password Reset!</h1>
          <p className="auth-subtitle">Your password has been updated successfully. You can now sign in with your new password.</p>
          <Link to="/login" className="btn btn-primary btn-lg w-full" style={{ marginTop: 'var(--space-4)', display: 'flex' }} id="back-to-login-link">
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">SS</div>
          <div>
            <div className="auth-logo-text">StockSense</div>
            <div className="auth-logo-sub">Inventory Management</div>
          </div>
        </div>

        <h1 className="auth-title">
          {step === 'email' ? 'Forgot password?' : 'Enter OTP'}
        </h1>
        <p className="auth-subtitle">
          {step === 'email'
            ? 'Enter your registered email and we will send you a one-time password.'
            : `OTP sent to ${email}. It expires in 10 minutes.`}
        </p>

        {error && (
          <div className="alert alert-error" role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleRequestOTP} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-email">
                Email Address <span className="required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input
                  id="reset-email"
                  type="email"
                  className="input"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ paddingLeft: 36 }}
                  autoFocus
                />
              </div>
            </div>

            <button
              id="send-otp-btn"
              type="submit"
              className={`btn btn-primary w-full btn-lg${loading ? ' btn-loading' : ''}`}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
              {loading ? 'Sending OTP…' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-otp">
                OTP Code <span className="required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input
                  id="reset-otp"
                  className="input"
                  placeholder="Enter the OTP from your email"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  style={{ paddingLeft: 36, letterSpacing: 4, fontFamily: 'var(--font-mono)' }}
                  autoFocus
                  maxLength={6}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reset-new-pass">New Password <span className="required">*</span></label>
              <input
                id="reset-new-pass"
                type="password"
                className="input"
                placeholder="Enter new password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reset-confirm-pass">Confirm Password <span className="required">*</span></label>
              <input
                id="reset-confirm-pass"
                type="password"
                className="input"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>

            <button
              id="reset-password-btn"
              type="submit"
              className={`btn btn-primary w-full btn-lg${loading ? ' btn-loading' : ''}`}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>

            <button
              type="button"
              className="btn btn-ghost w-full"
              style={{ marginTop: 'var(--space-2)' }}
              onClick={() => { setStep('email'); setError(''); }}
            >
              ← Change email
            </button>
          </form>
        )}

        <div className="auth-footer">
          Remember your password? <Link to="/login" id="back-to-signin">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
