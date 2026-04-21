import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

import { AuthProvider } from './contexts/AuthContext.jsx';
import App from './App.jsx';
import AdminApp from './pages/AdminApp.jsx';

const isAdmin = window.location.pathname.startsWith('/admin');

ReactDOM.createRoot(document.getElementById('root')).render(
  isAdmin
    ? <AdminApp />
    : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )
);