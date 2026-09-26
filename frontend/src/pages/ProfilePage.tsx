// User Profile Page
import { useState } from 'react';
import { User, Shield, Mail, KeyRound, LogOut, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { users as usersApi } from '../api';
import { errMsg } from '../utils/format';

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(user?.name || 'Administrator');
  const [isSaving, setIsSaving] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      updateUser(await usersApi.updateMe({ name: name.trim() }));
      showToast('Profile information updated successfully.', 'success');
    } catch (err) {
      showToast(errMsg(err, 'Could not update profile.'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setPwdMsg({ type: 'error', text: 'Current password is required.' });
      return;
    }
    if (newPassword.length < 8) {
      setPwdMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    try {
      await usersApi.changePassword(currentPassword, newPassword);
    } catch (err) {
      setPwdMsg({ type: 'error', text: errMsg(err, 'Could not change password.') });
      return;
    }
    setPwdMsg({ type: 'success', text: 'Password has been updated successfully.' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    showToast('Password changed successfully', 'success');
  };

  const initials = name
    ? name
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your account information and security credentials</p>
        </div>
      </div>

      {/* User Card */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--color-accent) 0%, #4338ca 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
              color: 'white',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{name}</h2>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--color-text-muted)' }}>
                <Mail size={14} /> {user?.email || 'admin@stocksense.com'}
              </span>
              <span
                className="badge"
                style={{
                  background: 'var(--color-accent-subtle)',
                  color: 'var(--color-accent)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Shield size={12} /> {user?.role === 'INVENTORY_MANAGER' ? 'Inventory Manager' : 'Warehouse Staff'}
              </span>
            </div>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={logout}
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-error)' }}
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {/* Personal Info Section */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <User size={18} style={{ color: 'var(--color-accent)' }} /> Account Details
        </h3>

        <form onSubmit={handleSaveProfile}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 20 }}>
            <div>
              <label className="label">Full Name</label>
              <input
                type="text"
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>

            <div>
              <label className="label">Email Address (Read-only)</label>
              <input
                type="email"
                className="input"
                value={user?.email || 'admin@stocksense.com'}
                disabled
                style={{ width: '100%', opacity: 0.7, cursor: 'not-allowed' }}
              />
            </div>

            <div>
              <label className="label">Assigned Role</label>
              <input
                type="text"
                className="input"
                value={user?.role === 'INVENTORY_MANAGER' ? 'Inventory Manager (Full Access)' : 'Warehouse Staff (Fulfillment)'}
                disabled
                style={{ width: '100%', opacity: 0.7, cursor: 'not-allowed' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password Section */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <KeyRound size={18} style={{ color: 'var(--color-accent)' }} /> Security & Password
        </h3>

        {pwdMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: pwdMsg.type === 'error' ? 'var(--color-error-subtle)' : 'var(--color-success-subtle)',
              color: pwdMsg.type === 'error' ? 'var(--color-error)' : 'var(--color-success)',
              fontSize: 13,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircle2 size={16} />
            <span>{pwdMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 440, marginBottom: 20 }}>
            <div>
              <label className="label">Current Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>

            <div>
              <label className="label">New Password</label>
              <input
                type="password"
                className="input"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>

            <div>
              <label className="label">Confirm New Password</label>
              <input
                type="password"
                className="input"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-secondary">
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
}
