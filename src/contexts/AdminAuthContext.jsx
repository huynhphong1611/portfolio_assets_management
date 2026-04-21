import React, { createContext, useState, useContext, useEffect } from 'react';
import {
  setAdminToken, getAdminToken, clearAdminToken, apiAdminLogin, apiAdminMe
} from '../services/adminApi';

const AdminAuthContext = createContext();

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}

export function AdminAuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from sessionStorage on mount
  useEffect(() => {
    const token = getAdminToken();
    if (token) {
      apiAdminMe()
        .then((data) => {
          setAdminUser({ username: data.username, role: data.role });
        })
        .catch(() => {
          clearAdminToken();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const adminLogin = async (username, password) => {
    const data = await apiAdminLogin(username, password);
    if (data?.token) {
      setAdminToken(data.token);
      setAdminUser({ username: data.username, role: data.role });
      return true;
    }
    return false;
  };

  const adminLogout = () => {
    clearAdminToken();
    setAdminUser(null);
  };

  return (
    <AdminAuthContext.Provider value={{ adminUser, adminLogin, adminLogout, loading }}>
      {!loading && children}
    </AdminAuthContext.Provider>
  );
}
