import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { setAuthToken, authAPI } from '../services/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'terraempleo_token';
const USER_KEY  = 'terraempleo_user';

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [token, setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { restoreSession(); }, []);

  const restoreSession = async () => {
    try {
      const savedToken   = await SecureStore.getItemAsync(TOKEN_KEY);
      const savedUserStr = await SecureStore.getItemAsync(USER_KEY);
      if (savedToken && savedUserStr) {
        setAuthToken(savedToken);
        try {
          const res = await authAPI.getPerfil();
          setToken(savedToken);
          setUser(res.data.user);
          console.log('SESSION RESTORED', res.data.user?.nombre_completo);
        } catch {
          console.log('SESSION EXPIRED, clearing');
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          await SecureStore.deleteItemAsync(USER_KEY);
          setAuthToken(null);
        }
      }
    } catch (err) {
      console.error('Error restoring session:', err);
    } finally {
      setLoading(false);
    }
  };

  const signIn = useCallback(async (userData, authToken) => {
    console.log('SIGN_IN', userData?.nombre_completo);
    setAuthToken(authToken);
    setToken(authToken);
    setUser(userData);
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, authToken);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));
    } catch (err) {
      console.error('Error saving session:', err);
    }
  }, []);

  const signOut = useCallback(async () => {
    console.log('SIGN_OUT');
    setAuthToken(null);
    setToken(null);
    setUser(null);
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch (err) {
      console.error('Error clearing session:', err);
    }
  }, []);

  /**
   * Intenta restaurar la sesión guardada (sin pedir contraseña).
   * El llamador debe haber verificado la biometría antes.
   * Retorna { ok: true } | { ok: false, reason: 'no_session' | 'expired' }
   */
  const tryBiometricLogin = useCallback(async () => {
    try {
      const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!savedToken) return { ok: false, reason: 'no_session' };
      setAuthToken(savedToken);
      const res = await authAPI.getPerfil();
      const freshUser = res.data.user;
      setToken(savedToken);
      setUser(freshUser);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(freshUser)).catch(() => {});
      return { ok: true };
    } catch {
      setAuthToken(null);
      return { ok: false, reason: 'expired' };
    }
  }, []);

  const updateUser = useCallback((userData) => {
    setUser(prev => {
      const updated = { ...prev, ...userData };
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut, updateUser, tryBiometricLogin, setLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
