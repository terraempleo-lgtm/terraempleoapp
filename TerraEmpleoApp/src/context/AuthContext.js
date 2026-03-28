import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { setAuthToken, authAPI } from '../services/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'terraempleo_token';
const USER_KEY = 'terraempleo_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restaurar sesión al iniciar
  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      const savedUserStr = await SecureStore.getItemAsync(USER_KEY);

      if (savedToken && savedUserStr) {
        setAuthToken(savedToken);
        // Validar que el token sigue siendo válido
        try {
          const res = await authAPI.getPerfil();
          const freshUser = res.data.user;
          setToken(savedToken);
          setUser(freshUser);
          console.log('SESSION RESTORED', freshUser.nombre_completo);
        } catch (err) {
          // Token expirado o inválido
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

  const updateUser = useCallback((userData) => {
    setUser(prev => {
      const updated = { ...prev, ...userData };
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut, updateUser, setLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
