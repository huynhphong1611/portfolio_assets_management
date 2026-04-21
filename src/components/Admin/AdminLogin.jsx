import React, { useState } from 'react';
import { Shield, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { useAdminAuth } from '../../contexts/AdminAuthContext.jsx';

export default function AdminLogin() {
  const { adminLogin } = useAdminAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError('');
    try {
      const ok = await adminLogin(username, password);
      if (!ok) setError('Sai tài khoản hoặc mật khẩu admin.');
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-screen">
      <div className="admin-login-card glass-card">
        <div className="admin-login-logo">
          <Shield size={40} />
        </div>
        <div className="admin-login-header">
          <h1>Admin Portal</h1>
          <p>Portfolio Management System</p>
        </div>

        <form className="admin-login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Tài khoản Admin</label>
            <input
              id="admin-username"
              type="text"
              className="form-input"
              placeholder="admin"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <input
                id="admin-password"
                type={showPwd ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                style={{
                  position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                }}
                onClick={() => setShowPwd(v => !v)}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="admin-login-error">
              <Lock size={14} /> {error}
            </div>
          )}

          <button
            id="admin-login-btn"
            type="submit"
            className="btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading || !username || !password}
          >
            {loading ? <><Loader2 size={16} className="spin" /> Đang xác thực...</> : 'Đăng nhập Admin'}
          </button>
        </form>

        <div className="admin-login-footer">
          <a href="/" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            ← Về trang người dùng
          </a>
        </div>
      </div>
    </div>
  );
}
