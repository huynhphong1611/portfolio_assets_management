import React, { createContext, useState, useContext, useEffect } from 'react';
import { authenticateUser, getServiceUserId, setServiceUserId, registerUser } from '../services/firestoreService';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

// Helper: Hashing function in frontend (SHA-256)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load session from localStorage on boot or Firebase Auth
  useEffect(() => {
    let firebaseUnsub;

    const savedUser = localStorage.getItem('portfolioUser');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setServiceUserId(user.id, user.type);
      setCurrentUser(user);
      setLoading(false);
    } else {
      // If no custom user, listen to Firebase Auth
      firebaseUnsub = onAuthStateChanged(auth, (fbUser) => {
        if (fbUser) {
          const u = { id: fbUser.uid, username: fbUser.email, type: 'firebase' };
          setServiceUserId(u.id, u.type);
          setCurrentUser(u);
        } else {
          setCurrentUser(null);
          setServiceUserId(null);
        }
        setLoading(false);
      });
    }

    return () => {
      if (firebaseUnsub) firebaseUnsub();
    };
  }, []);

  const login = async (username, password) => {
    const passHash = await hashPassword(password);
    const user = await authenticateUser(username, passHash);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('portfolioUser', JSON.stringify(user));
      return true;
    }
    return false;
  };

  const register = async (username, password) => {
    const passHash = await hashPassword(password);
    const user = await registerUser(username, passHash);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('portfolioUser', JSON.stringify(user));
      return true;
    }
    return false;
  };

  const loginFirebase = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const u = { id: userCredential.user.uid, username: userCredential.user.email, type: 'firebase' };
    setCurrentUser(u);
    setServiceUserId(u.id, u.type);
    return true;
  };

  const registerFirebase = async (email, password) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const u = { id: userCredential.user.uid, username: userCredential.user.email, type: 'firebase' };
    setCurrentUser(u);
    setServiceUserId(u.id, u.type);
    return true;
  };

  const logout = async () => {
    if (currentUser?.type === 'firebase') {
      await signOut(auth);
    }
    setCurrentUser(null);
    setServiceUserId(null);
    localStorage.removeItem('portfolioUser');
  };

  const value = {
    currentUser,
    login,
    register,
    loginFirebase,
    registerFirebase,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
