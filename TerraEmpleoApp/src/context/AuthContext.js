import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { setAuthToken, setGlobalSignOutHandler, authAPI } from '../services/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'terraempleo_token';
const USER_KEY  = 'terraempleo_user';
const isWeb = Platform.OS === 'web';
const memoryStore = {};

const localGet = (key) => {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
  } catch (_) {}
  return memoryStore[key] || null;
};

const localSet = (key, value) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch (_) {}
  memoryStore[key] = value;
};

const localDelete = (key) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
  } catch (_) {}
  delete memoryStore[key];
};

const getStoredItem = async (key) => {
  if (isWeb) return localGet(key);
  if (typeof SecureStore?.getItemAsync === 'function') return SecureStore.getItemAsync(key);
  return localGet(key);
};

const setStoredItem = async (key, value) => {
  if (isWeb) return localSet(key, value);
  if (typeof SecureStore?.setItemAsync === 'function') return SecureStore.setItemAsync(key, value);
  return localSet(key, value);
};

const deleteStoredItem = async (key) => {
  if (isWeb) return localDelete(key);
  if (typeof SecureStore?.deleteItemAsync === 'function') return SecureStore.deleteItemAsync(key);
  return localDelete(key);
};

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [token, setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { restoreSession(); }, []);

  const restoreSession = async () => {
    try {
      const savedToken   = await getStoredItem(TOKEN_KEY);
      const savedUserStr = await getStoredItem(USER_KEY);
      if (savedToken && savedUserStr) {
        // Restaurar inmediatamente desde datos locales — el usuario no espera ni se desloguea por mala red
        const savedUser = JSON.parse(savedUserStr);
        setAuthToken(savedToken);
        setToken(savedToken);
        setUser(savedUser);
        // Validar en background: solo cerrar sesión si el servidor dice 401 (token inválido)
        authAPI.getPerfil()
          .then(res => setUser(res.data.user))
          .catch(async err => {
            if (err.response?.status === 401) {
              // Token rechazado por el servidor — cerrar sesión
              setAuthToken(null);
              setToken(null);
              setUser(null);
              await deleteStoredItem(TOKEN_KEY).catch(() => {});
              await deleteStoredItem(USER_KEY).catch(() => {});
            }
            // Errores de red, timeout, 5xx → mantener sesión local
          });
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
      await setStoredItem(TOKEN_KEY, authToken);
      await setStoredItem(USER_KEY, JSON.stringify(userData));
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
      await deleteStoredItem(TOKEN_KEY);
      await deleteStoredItem(USER_KEY);
    } catch (err) {
      console.error('Error clearing session:', err);
    }
    // Limpiar cache local SQLite para no mezclar datos entre cuentas
    try {
      const { clearAll } = require('../db/database');
      await clearAll();
    } catch (_) {}
    // Limpiar borradores de formularios para no mezclar entre cuentas
    try {
      const { clearAllDrafts } = require('../utils/formDrafts');
      await clearAllDrafts();
    } catch (_) {}
  }, []);

  useEffect(() => { setGlobalSignOutHandler(signOut); }, [signOut]);

  /**
   * Intenta restaurar la sesión guardada (sin pedir contraseña).
   * El llamador debe haber verificado la biometría antes.
   * Retorna { ok: true } | { ok: false, reason: 'no_session' | 'expired' }
   */
  const tryBiometricLogin = useCallback(async () => {
    try {
      const savedToken = await getStoredItem(TOKEN_KEY);
      if (!savedToken) return { ok: false, reason: 'no_session' };
      setAuthToken(savedToken);
      const res = await authAPI.getPerfil();
      const freshUser = res.data.user;
      setToken(savedToken);
      setUser(freshUser);
      await setStoredItem(USER_KEY, JSON.stringify(freshUser)).catch(() => {});
      return { ok: true };
    } catch {
      setAuthToken(null);
      return { ok: false, reason: 'expired' };
    }
  }, []);

  const updateUser = useCallback((userData) => {
    setUser(prev => {
      const updated = { ...prev, ...userData };
      setStoredItem(USER_KEY, JSON.stringify(updated)).catch(() => {});
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
