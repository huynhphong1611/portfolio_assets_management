import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Activity, Lock, User, Loader2, Mail, Database } from 'lucide-react';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function Login() {
  const [tab, setTab] = useState('firebase'); // 'firebase' or 'guest'
  const [isRegister, setIsRegister] = useState(false);
  
  const [username, setUsername] = useState(''); // Used for both email and guest username
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Data Migration states
  const [migrating, setMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState('');

  const { login, register, loginFirebase, registerFirebase, currentUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Vui lòng nhập tài khoản và mật khẩu.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      if (tab === 'firebase') {
        if (isRegister) {
          await registerFirebase(username, password);
        } else {
          await loginFirebase(username, password);
        }
      } else {
        if (isRegister) {
          const success = await register(username, password);
          if (!success) setError('Lỗi đăng ký. Bị trùng tên?');
        } else {
          const success = await login(username, password);
          if (!success) setError('Sai thông tin khách.');
        }
      }
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra.');
    } finally {
      if (tab === 'firebase') setLoading(false); 
      // Guest local logic stops loading manually
      if (tab === 'guest') setLoading(false);
    }
  };

  // --- MIGRATION LOGIC MOCKUP ---
  const handleMigrateOldData = async () => {
    if (!window.confirm("Thao tác này sẽ chép tất cả dữ liệu cũ ở màn hình chờ (ngoài user) vào User đang đăng nhập này. Tiếp tục?")) return;
    
    setMigrating(true);
    setMigrationStatus("Đang đọc dữ liệu cũ...");
    setError('');

    try {
      if (!currentUser) throw new Error("Chưa đăng nhập! Vui lòng đăng nhập vào 1 user để chứa dữ liệu cũ trước.");

      const collectionsToMigrate = ['transactions', 'externalAssets', 'liabilities', 'funds', 'dailySnapshots', 'dailyPrices'];
      let copiedCount = 0;

      for (const colName of collectionsToMigrate) {
        setMigrationStatus(`Đang sao chép: ${colName}...`);
        // Lấy data ở cấp ROOT (data cũ)
        const rootSnap = await getDocs(collection(db, colName));
        
        for (const rootDoc of rootSnap.docs) {
          // Ghi vào sub-collection của user hiện tại
          const targetRef = doc(db, "users", currentUser.id, colName, rootDoc.id);
          await setDoc(targetRef, rootDoc.data());
          copiedCount++;
        }
      }
      setMigrationStatus(`Hoàn tất! Đã copy ${copiedCount} records.`);
      setTimeout(() => setMigrationStatus(''), 5000);
    } catch (err) {
      setError(err.message);
      setMigrationStatus('');
    } finally {
      setMigrating(false);
    }
  };

  // Nếu user vừa đăng nhập xong mà component chưa bị unmount, có tuỳ chọn migrate
  if (currentUser) {
    return (
      <div className="app-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-main)' }}>
        <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '2rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', marginBottom: '1rem' }}>
            <User size={32} />
          </div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Đăng nhập thành công</h2>
          <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>Đang tải bảng điều khiển...</p>
          
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>CÔNG CỤ DEBUG</h4>
            <button 
              className="btn-glass" 
              onClick={handleMigrateOldData} 
              disabled={migrating}
              style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem', borderColor: 'var(--color-primary-400)' }}
            >
              {migrating ? <Loader2 size={16} className="spin" /> : <Database size={16} />}
              {migrating ? 'Đang xử lý...' : 'Đồng bộ Dữ liệu cũ vào User này'}
            </button>
            {migrationStatus && <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-emerald-400)' }}>{migrationStatus}</p>}
            {error && <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-rose-400)' }}>{error}</p>}
            
            <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>*Lưu ý: Bấm Reload trang Web để vào app bình thường nếu không muốn đồng bộ data cũ.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '0', overflow: 'hidden' }}>
        
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <button 
            type="button"
            onClick={() => { setTab('firebase'); setIsRegister(false); setError(''); }}
            style={{ flex: 1, padding: '1rem', background: tab === 'firebase' ? 'rgba(99, 102, 241, 0.1)' : 'transparent', border: 'none', borderBottom: tab === 'firebase' ? '2px solid var(--color-primary-500)' : '2px solid transparent', color: tab === 'firebase' ? 'var(--color-primary-400)' : 'var(--text-secondary)', fontWeight: tab === 'firebase' ? 'bold' : 'normal', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Chính thức
          </button>
          <button 
            type="button"
            onClick={() => { setTab('guest'); setIsRegister(false); setError(''); }}
            style={{ flex: 1, padding: '1rem', background: tab === 'guest' ? 'rgba(16, 185, 129, 0.1)' : 'transparent', border: 'none', borderBottom: tab === 'guest' ? '2px solid var(--color-emerald-500)' : '2px solid transparent', color: tab === 'guest' ? 'var(--color-emerald-400)' : 'var(--text-secondary)', fontWeight: tab === 'guest' ? 'bold' : 'normal', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Khách / Dev
          </button>
        </div>

        <div style={{ padding: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(59, 130, 246, 0.2))', border: '1px solid rgba(99, 102, 241, 0.3)', marginBottom: '1rem' }}>
              <Activity className="color-primary" size={32} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
              {isRegister ? 'Tạo Tài Khoản' : 'Đăng nhập App'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '0.85rem' }}>
              {tab === 'firebase' ? 'Sử dụng hệ thống Firebase xác thực nhanh' : 'Đăng nhập ẩn danh bằng Custom SHA-256'}
            </p>
          </div>

          {error && (
            <div style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {tab === 'firebase' ? 'Email' : 'Tên đăng nhập (Username)'}
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                {tab === 'firebase' ? (
                  <Mail size={18} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                ) : (
                  <User size={18} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                )}
                <input
                  type={tab === 'firebase' ? "email" : "text"}
                  className="form-input"
                  style={{ paddingLeft: '2.5rem', width: '100%', boxSizing: 'border-box' }}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={tab === 'firebase' ? "you@example.com" : "Ví dụ: admin"}
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Mật khẩu</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem', width: '100%', boxSizing: 'border-box' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', background: tab === 'guest' ? 'var(--color-emerald-500)' : '' }} disabled={loading}>
              {loading ? <Loader2 size={18} className="spin" /> : (isRegister ? 'Đăng Ký' : 'Đăng Nhập')}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
            </span>{' '}
            <button
              type="button"
              style={{ background: 'none', border: 'none', color: tab === 'guest' ? 'var(--color-emerald-400)' : 'var(--color-primary-400)', cursor: 'pointer', fontWeight: '500' }}
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
            >
              {isRegister ? 'Đăng nhập ngay' : 'Đăng ký ngay'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
