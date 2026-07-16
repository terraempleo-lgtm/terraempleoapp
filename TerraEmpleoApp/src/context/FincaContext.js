import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fincaAPI } from '../services/api';
import { useAuth } from './AuthContext';

const FincaContext = createContext(null);

const CAPATAZ_ROLES = ['administrador', 'auxiliar'];

export function FincaProvider({ children }) {
  const { user } = useAuth();
  const [fincas, setFincas] = useState([]);
  const [activeFincaId, setActiveFincaId] = useState(null);
  const [loading, setLoading] = useState(true);
  // Permite al propietario previsualizar la vista de capataz sin perder sus permisos reales.
  const [modoAdminPreview, setModoAdminPreview] = useState(false);

  const cargarFincas = useCallback(async () => {
    if (!user || (user.rol !== 'empleador' && user.rol !== 'admin')) {
      setFincas([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fincaAPI.misFincas();
      const lista = res.data?.fincas || [];
      setFincas(lista);
      setActiveFincaId(prev => {
        if (prev && lista.some(f => f.id === prev)) return prev;
        return lista[0]?.id ?? null;
      });
    } catch (err) {
      console.error('Error cargando fincas:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { cargarFincas(); }, [cargarFincas]);

  const activeFinca = fincas.find(f => f.id === activeFincaId) || null;
  const rolFincaReal = activeFinca?.rol_finca || null;
  const esCapatazReal = CAPATAZ_ROLES.includes(rolFincaReal);
  // Vista efectiva: si el propietario activó "modo admin" ve como capataz.
  const esCapataz = esCapatazReal || (rolFincaReal === 'propietario' && modoAdminPreview);
  const rolFinca = modoAdminPreview && rolFincaReal === 'propietario' ? 'administrador' : rolFincaReal;

  const value = {
    fincas,
    activeFinca,
    activeFincaId,
    setActiveFincaId,
    rolFinca,
    rolFincaReal,
    esCapataz,
    esCapatazReal,
    esPropietario: rolFincaReal === 'propietario',
    modoAdminPreview,
    setModoAdminPreview,
    loading,
    recargarFincas: cargarFincas,
  };

  return <FincaContext.Provider value={value}>{children}</FincaContext.Provider>;
}

export function useFinca() {
  const ctx = useContext(FincaContext);
  if (!ctx) throw new Error('useFinca debe usarse dentro de FincaProvider');
  return ctx;
}
