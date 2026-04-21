import React, { useState, useEffect } from 'react';
import { Users, CheckCircle, XCircle, ChevronRight, Loader2 } from 'lucide-react';
import { apiGetAdminUsers, apiSetUserActive } from '../../services/adminApi';

export default function AdminUserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGetAdminUsers();
      setUsers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (user) => {
    setUpdating(user.id);
    try {
      await apiSetUserActive(user.id, !user.isActive);
      setUsers(prev => prev.map(u =>
        u.id === user.id ? { ...u, isActive: !u.isActive } : u
      ));
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <div className="admin-loading"><Loader2 className="spin" size={20} /> Đang tải...</div>;

  return (
    <div className="admin-section animate-fade-in">
      <div className="admin-section-header">
        <div>
          <h2 className="admin-section-title">👥 Quản lý Users</h2>
          <p className="admin-section-subtitle">
            {users.length} người dùng trong hệ thống.
          </p>
        </div>
        <button className="btn-glass btn-sm" onClick={load}>
          <Users size={14} /> Refresh
        </button>
      </div>

      <div className="admin-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Loại</th>
                <th className="text-center">Trạng thái</th>
                <th>Ngày tạo</th>
                <th className="text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="table-row-hover">
                  <td>
                    <div className="td-ticker">{user.username}</div>
                    <div className="td-meta td-mono" style={{ fontSize: '0.7rem' }}>{user.id}</div>
                  </td>
                  <td>
                    <span className={`admin-badge ${user.type === 'firebase' ? 'admin-badge--blue' : 'admin-badge--orange'}`}>
                      {user.type === 'firebase' ? '🔥 Firebase' : '👤 Guest'}
                    </span>
                  </td>
                  <td className="text-center">
                    {user.isActive !== false
                      ? <CheckCircle size={16} style={{ color: 'var(--color-emerald-500)' }} />
                      : <XCircle size={16} style={{ color: 'var(--color-rose-500)' }} />
                    }
                  </td>
                  <td className="td-meta">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td className="text-center">
                    <button
                      className={`btn-glass btn-xs ${user.isActive === false ? 'btn-success' : 'btn-danger'}`}
                      onClick={() => toggleActive(user)}
                      disabled={updating === user.id}
                      title={user.isActive === false ? 'Kích hoạt' : 'Vô hiệu hoá'}
                    >
                      {updating === user.id
                        ? <Loader2 size={12} className="spin" />
                        : user.isActive === false ? 'Bật' : 'Tắt'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
