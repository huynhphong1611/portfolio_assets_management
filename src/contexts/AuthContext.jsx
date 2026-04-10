import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  apiGuestLogin, apiGuestRegister, apiFirebaseVerify,
  setAuthToken, clearAuthToken
} from '../services/api';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load session from localStorage on boot or Firebase Auth
  useEffect(() => {
    let firebaseUnsub;

    const savedUser = localStorage.getItem('portfolioUser');
    const savedToken = localStorage.getItem('portfolioToken');

    if (savedUser && savedToken) {
      const user = JSON.parse(savedUser);
      setAuthToken(savedToken);
      setCurrentUser(user);
      setLoading(false);
    } else {
      // If no saved session, listen to Firebase Auth
      firebaseUnsub = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          try {
            // Get Firebase ID token and verify with our backend
            const idToken = await fbUser.getIdToken();
            const result = await apiFirebaseVerify(idToken);
            const u = { id: result.id, username: result.username, type: result.type };
            setAuthToken(result.token);
            setCurrentUser(u);
            localStorage.setItem('portfolioUser', JSON.stringify(u));
            localStorage.setItem('portfolioToken', result.token);
          } catch (err) {
            console.error('Firebase verify failed:', err);
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
          clearAuthToken();
        }
        setLoading(false);
      });
    }

    return () => {
      if (firebaseUnsub) firebaseUnsub();
    };
  }, []);

  const login = async (username, password) => {
    // Guest login — backend handles hashing
    const result = await apiGuestLogin(username, password);
    if (result && result.token) {
      const u = { id: result.id, username: result.username, type: result.type };
      setAuthToken(result.token);
      setCurrentUser(u);
      localStorage.setItem('portfolioUser', JSON.stringify(u));
      localStorage.setItem('portfolioToken', result.token);
      return true;
    }
    return false;
  };

  const register = async (username, password) => {
    const result = await apiGuestRegister(username, password);
    if (result && result.token) {
      const u = { id: result.id, username: result.username, type: result.type };
      setAuthToken(result.token);
      setCurrentUser(u);
      localStorage.setItem('portfolioUser', JSON.stringify(u));
      localStorage.setItem('portfolioToken', result.token);
      return true;
    }
    return false;
  };

  const loginFirebase = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();

    // Verify with our backend and get JWT
    const result = await apiFirebaseVerify(idToken);
    const u = { id: result.id, username: result.username, type: result.type };
    setAuthToken(result.token);
    setCurrentUser(u);
    localStorage.setItem('portfolioUser', JSON.stringify(u));
    localStorage.setItem('portfolioToken', result.token);
    return true;
  };

  const registerFirebase = async (email, password) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();

    const result = await apiFirebaseVerify(idToken);
    const u = { id: result.id, username: result.username, type: result.type };
    setAuthToken(result.token);
    setCurrentUser(u);
    localStorage.setItem('portfolioUser', JSON.stringify(u));
    localStorage.setItem('portfolioToken', result.token);
    return true;
  };

  const logout = async () => {
    if (currentUser?.type === 'firebase') {
      await signOut(auth);
    }
    setCurrentUser(null);
    clearAuthToken();
    localStorage.removeItem('portfolioUser');
    localStorage.removeItem('portfolioToken');
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
