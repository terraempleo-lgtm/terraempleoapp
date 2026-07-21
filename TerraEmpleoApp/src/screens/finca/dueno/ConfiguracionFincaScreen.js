import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fincaAPI, finanzasAPI } from '../../../services/api';
import { useFinca } from '../../../context/FincaContext';

const COLORS = {
  primary: '#008d49', primarySoft: '#e5f6ec',
  info: '#2563eb', infoSoft: '#e0edff',
  danger: '#dc2626', dangerSoft: '#fee2e2',
  ink900: '#171a15', ink700: '#3f4438', ink500: '#6b7060', ink400: '#8b9080',
  line: '#e4e6de', lineLight: '#f4f5f0',
};

function generarPassword() {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return out;
}

const ROLES_LABEL = { propietario: 'Propietario', administrador: 'Administrador', auxiliar: 'Auxiliar', contador: 'Contador' };

export default function ConfiguracionFincaScreen({ navigation }) {
  const { activeFinca, activeFincaId, esPropietario, recargarFincas } = useFinca();
  const [form, setForm] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [nuevoLote, setNuevoLote] = useState({ nombre: '', cultivo: '', unidad_tamano: 'hectareas', tamano: '' });
  const [creandoLote, setCreandoLote] = useState(false);
  const [errorLote, setErrorLote] = useState('');
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorEquipo, setErrorEquipo] = useState('');
  const [modoInvitar, setModoInvitar] = useState('crear');
  const [inv, setInv] = useState({ celular: '', rol_finca: 'auxiliar' });
  const [nueva, setNueva] = useState({ nombre_completo: '', celular: '', password: generarPassword(), rol_finca: 'administrador' });
  const [creando, setCreando] = useState(false);
  const [credenciales, setCredenciales] = useState(null);
  const [periodo, setPeriodo] = useState(null);
  const [unidadVenta, setUnidadVenta] = useState('pergamino');
  const [precioVenta, setPrecioVenta] = useState('');
  const [guardandoPrecio, setGuardandoPrecio] = useState(false);

  useEffect(() => {
    if (!activeFinca) return;
    setForm({
      nombre: activeFinca.nombre || '', municipio: activeFinca.municipio || '', vereda: activeFinca.vereda || '',
      hectareas: activeFinca.hectareas != null ? String(activeFinca.hectareas) : '',
      modalidad_alimentacion: activeFinca.modalidad_alimentacion || 'incluida',
      factor_conversion: String(activeFinca.factor_conversion ?? 5), kg_por_arroba: String(activeFinca.kg_por_arroba ?? 12.5),
      kg_por_carga: String(activeFinca.kg_por_carga ?? 125), umbral_merma_pct: String(activeFinca.umbral_merma_pct ?? 15),
    });
    fincaAPI.listarUsuarios(activeFincaId).then((r) => setUsuarios(r.data?.usuarios || [])).catch(() => {}).finally(() => setLoading(false));
    fincaAPI.listarLotesFinca(activeFincaId).then((r) => setLotes(r.data?.lotes || [])).catch(() => {});
    const hoy = new Date();
    finanzasAPI.tablero({ finca_id: activeFincaId, anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 })
      .then((r) => setPeriodo(r.data?.periodo || null))
      .catch(() => {});
  }, [activeFinca]);

  const UNIDADES_VENTA = [
    { key: 'cereza', label: 'Cereza (kg)', campo: 'precio_venta_kilo_cereza' },
    { key: 'pergamino', label: 'Pergamino (kg)', campo: 'precio_venta_kilo' },
    { key: 'arroba', label: 'Arroba', campo: 'precio_venta_arroba' },
  ];
  const campoVentaActivo = UNIDADES_VENTA.find((u) => u.key === unidadVenta)?.campo;

  useEffect(() => {
    if (!periodo || !campoVentaActivo) return;
    const v = periodo[campoVentaActivo];
    setPrecioVenta(v != null ? String(v) : '');
  }, [periodo, campoVentaActivo]);

  const guardarPrecioVenta = async () => {
    if (!periodo?.id) return;
    setGuardandoPrecio(true);
    try {
      const valor = precioVenta.trim() ? Number(precioVenta) : null;
      await finanzasAPI.actualizarPrecioVenta(periodo.id, { [campoVentaActivo]: valor });
      setPeriodo((p) => ({ ...p, [campoVentaActivo]: valor }));
      setMsg('Precio de venta guardado.');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo guardar el precio.');
    } finally { setGuardandoPrecio(false); }
  };

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!esPropietario) return;
    setGuardando(true); setMsg('');
    try {
      await fincaAPI.actualizar(activeFincaId, form);
      await recargarFincas();
      setMsg('Cambios guardados.');
      setTimeout(() => setMsg(''), 2500);
    } catch (e) { setMsg(e.response?.data?.error || 'Error al guardar.'); } finally { setGuardando(false); }
  };

  const invitar = async () => {
    if (!inv.celular.trim()) return;
    setErrorEquipo('');
    try {
      await fincaAPI.invitarUsuario(activeFincaId, inv);
      setInv({ celular: '', rol_finca: 'auxiliar' });
      const u = await fincaAPI.listarUsuarios(activeFincaId);
      setUsuarios(u.data?.usuarios || []);
    } catch (e) {
      setErrorEquipo(e.response?.data?.error || 'No se pudo invitar. Verifica que el celular ya tenga cuenta en TerraEmpleo.');
    }
  };

  const crearCuenta = async () => {
    setErrorEquipo('');
    if (!nueva.nombre_completo.trim()) { setErrorEquipo('Escribe el nombre del capataz.'); return; }
    if (!/^\d{7,15}$/.test(nueva.celular.trim())) { setErrorEquipo('Celular inválido.'); return; }
    if (!nueva.password || nueva.password.length < 6) { setErrorEquipo('La contraseña debe tener mínimo 6 caracteres.'); return; }
    setCreando(true);
    try {
      await fincaAPI.crearCuentaUsuario(activeFincaId, {
        nombre_completo: nueva.nombre_completo.trim(), celular: nueva.celular.trim(), password: nueva.password, rol_finca: nueva.rol_finca,
      });
      setCredenciales({ celular: nueva.celular.trim(), password: nueva.password, rol_finca: nueva.rol_finca, nombre: nueva.nombre_completo.trim() });
      setNueva({ nombre_completo: '', celular: '', password: generarPassword(), rol_finca: 'administrador' });
      const u = await fincaAPI.listarUsuarios(activeFincaId);
      setUsuarios(u.data?.usuarios || []);
    } catch (e) {
      setErrorEquipo(e.response?.data?.error || 'No se pudo crear la cuenta.');
    } finally { setCreando(false); }
  };

  const compartirCredenciales = () => {
    if (!credenciales) return;
    const texto = `TerraEmpleo — acceso de ${ROLES_LABEL[credenciales.rol_finca]}\nUsuario (celular): ${credenciales.celular}\nContraseña: ${credenciales.password}`;
    Share.share({ message: texto }).catch(() => {});
  };

  const quitar = (u) => {
    Alert.alert('¿Quitar usuario?', `¿Quitar a ${u.nombre_completo} de la finca?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: async () => { try { await fincaAPI.quitarUsuario(activeFincaId, u.id); setUsuarios((p) => p.filter((x) => x.id !== u.id)); } catch (e) { console.error(e); } } },
    ]);
  };

  const crearLote = async () => {
    setErrorLote('');
    if (!nuevoLote.nombre.trim()) { setErrorLote('Escribe un nombre para el lote (ej: Lote 1).'); return; }
    setCreandoLote(true);
    try {
      const tamanoNum = nuevoLote.tamano.trim() ? Number(nuevoLote.tamano) : null;
      const payload = {
        nombre: nuevoLote.nombre.trim(),
        cultivo: nuevoLote.cultivo.trim() || null,
        unidad_tamano: nuevoLote.unidad_tamano,
        hectareas: nuevoLote.unidad_tamano === 'hectareas' ? tamanoNum : null,
        metros_cuadrados: nuevoLote.unidad_tamano === 'metros2' ? tamanoNum : null,
        palos_cafe: nuevoLote.unidad_tamano === 'palos_cafe' ? tamanoNum : null,
      };
      const r = await fincaAPI.crearLoteFinca(activeFincaId, payload);
      setLotes((p) => [...p, { id: r.data.id, ...payload }].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNuevoLote({ nombre: '', cultivo: '', unidad_tamano: 'hectareas', tamano: '' });
    } catch (e) {
      setErrorLote(e.response?.data?.error || 'No se pudo crear el lote.');
    } finally { setCreandoLote(false); }
  };

  const UNIDADES_TAMANO = [
    { val: 'hectareas', label: 'Hectáreas', sufijo: 'ha' },
    { val: 'metros2', label: 'Metros²', sufijo: 'm²' },
    { val: 'palos_cafe', label: 'Palos de café', sufijo: 'palos' },
  ];
  function tamanoLote(l) {
    if (l.unidad_tamano === 'metros2' && l.metros_cuadrados != null) return `${Number(l.metros_cuadrados).toLocaleString('es-CO')} m²`;
    if (l.unidad_tamano === 'palos_cafe' && l.palos_cafe != null) return `${Number(l.palos_cafe).toLocaleString('es-CO')} palos`;
    if (l.hectareas != null) return `${Number(l.hectareas).toLocaleString('es-CO')} ha`;
    return null;
  }

  const eliminarLote = (lote) => {
    Alert.alert('¿Eliminar lote?', `¿Eliminar "${lote.nombre}"? Las jornadas ya registradas conservan el historial.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await fincaAPI.eliminarLoteFinca(activeFincaId, lote.id); setLotes((p) => p.filter((x) => x.id !== lote.id)); } catch (e) { console.error(e); } } },
    ]);
  };

  const ejemploCereza = 5000;
  const factor = Number(form?.factor_conversion) || 5;
  const kgArroba = Number(form?.kg_por_arroba) || 12.5;
  const kgCarga = Number(form?.kg_por_carga) || 125;
  const pergamino = ejemploCereza / factor;

  if (loading || !form) return <SafeAreaView style={styles.screen}><ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={{ marginRight: 10 }}><Ionicons name="chevron-back" size={22} color={COLORS.ink900} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Configuración de finca</Text>
          <Text style={styles.headerSub}>Parámetros, conversión de café y equipo</Text>
        </View>
        {esPropietario && (
          <Pressable onPress={() => navigation.navigate('Auditoria')} style={styles.auditBtn}>
            <Ionicons name="time-outline" size={14} color={COLORS.ink700} /><Text style={styles.auditBtnText}>  Auditoría</Text>
          </Pressable>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        {!esPropietario && <View style={styles.infoBanner}><Text style={styles.infoBannerText}>Solo el propietario puede modificar la configuración. Estás en modo lectura.</Text></View>}
        {msg ? <View style={styles.okBanner}><Text style={styles.okBannerText}>{msg}</Text></View> : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Datos generales</Text>
          <Campo label="Nombre de la finca"><TextInput placeholderTextColor={COLORS.ink400} style={styles.input} editable={esPropietario} value={form.nombre} onChangeText={(v) => set('nombre', v)} /></Campo>
          <Campo label="Hectáreas"><TextInput placeholderTextColor={COLORS.ink400} style={styles.input} editable={esPropietario} keyboardType="numeric" value={form.hectareas} onChangeText={(v) => set('hectareas', v)} /></Campo>
          <Campo label="Municipio"><TextInput placeholderTextColor={COLORS.ink400} style={styles.input} editable={esPropietario} value={form.municipio} onChangeText={(v) => set('municipio', v)} /></Campo>
          <Campo label="Vereda"><TextInput placeholderTextColor={COLORS.ink400} style={styles.input} editable={esPropietario} value={form.vereda} onChangeText={(v) => set('vereda', v)} /></Campo>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Modalidad de alimentación</Text>
          <View style={styles.wrapRow}>
            {[['incluida', 'Incluida en el jornal'], ['independiente', 'Gasto independiente']].map(([val, t]) => (
              <Pressable key={val} disabled={!esPropietario} onPress={() => set('modalidad_alimentacion', val)} style={[styles.modChip, form.modalidad_alimentacion === val && styles.modChipActivo]}>
                <Text style={[styles.modChipText, form.modalidad_alimentacion === val && styles.modChipTextActivo]}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>☕ Conversión cereza → pergamino</Text>
          <Campo label="Factor (kg cereza / kg pergamino)"><TextInput placeholderTextColor={COLORS.ink400} style={styles.input} editable={esPropietario} keyboardType="decimal-pad" value={form.factor_conversion} onChangeText={(v) => set('factor_conversion', v)} /></Campo>
          <Campo label="Kg por arroba"><TextInput placeholderTextColor={COLORS.ink400} style={styles.input} editable={esPropietario} keyboardType="decimal-pad" value={form.kg_por_arroba} onChangeText={(v) => set('kg_por_arroba', v)} /></Campo>
          <Campo label="Kg por carga"><TextInput placeholderTextColor={COLORS.ink400} style={styles.input} editable={esPropietario} keyboardType="decimal-pad" value={form.kg_por_carga} onChangeText={(v) => set('kg_por_carga', v)} /></Campo>
          <Campo label="Umbral alerta merma (%)"><TextInput placeholderTextColor={COLORS.ink400} style={styles.input} editable={esPropietario} keyboardType="decimal-pad" value={form.umbral_merma_pct} onChangeText={(v) => set('umbral_merma_pct', v)} /></Campo>
          <View style={styles.ejemploBox}>
            <Text style={styles.ejemploText}>Ejemplo: {ejemploCereza.toLocaleString('es-CO')} kg cereza → {Math.round(pergamino).toLocaleString('es-CO')} kg pergamino · {(pergamino / kgArroba).toFixed(1)} @ · {(pergamino / kgCarga).toFixed(1)} cargas</Text>
          </View>
        </View>

        {esPropietario && (
          <Pressable onPress={guardar} disabled={guardando} style={styles.btnPrimary}>
            {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Guardar cambios</Text>}
          </Pressable>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>💰 Venta de café</Text>
          <Text style={styles.cardHint}>Elige en qué unidad vende el café este mes y a qué precio, para que las gráficas de costo/margen del Cuaderno lo usen.</Text>
          <View style={[styles.wrapRow, { marginTop: 8 }]}>
            {UNIDADES_VENTA.map((u) => (
              <Pressable key={u.key} disabled={!esPropietario} onPress={() => setUnidadVenta(u.key)} style={[styles.modChip, unidadVenta === u.key && styles.modChipActivo]}>
                <Text style={[styles.modChipText, unidadVenta === u.key && styles.modChipTextActivo]}>{u.label}</Text>
              </Pressable>
            ))}
          </View>
          <Campo label={`Precio de venta por ${UNIDADES_VENTA.find((u) => u.key === unidadVenta)?.label.toLowerCase()} este mes (COP)`}>
            <TextInput
              placeholderTextColor={COLORS.ink400} style={styles.input} editable={esPropietario}
              keyboardType="numeric" placeholder="Ej: 3200" value={precioVenta} onChangeText={setPrecioVenta}
            />
          </Campo>
          {esPropietario && (
            <Pressable onPress={guardarPrecioVenta} disabled={guardandoPrecio || !periodo} style={styles.btnPrimarySmall}>
              {guardandoPrecio ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimarySmallText}>Guardar precio</Text>}
            </Pressable>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🌱 Lotes de la finca</Text>
          <Text style={styles.cardHint}>Divide la finca en lotes (ej: Lote 1, Lote 2) para saber en qué parte trabajó cada jornalero y a qué lote pertenece el café recogido.</Text>
          {lotes.length === 0 ? (
            <Text style={styles.emptyLotesText}>Aún no has creado lotes.</Text>
          ) : (
            lotes.map((l) => (
              <View key={l.id} style={styles.loteRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userNombre}>{l.nombre}</Text>
                  {(l.cultivo || tamanoLote(l)) ? (
                    <Text style={styles.userCelular}>{[l.cultivo, tamanoLote(l)].filter(Boolean).join(' · ')}</Text>
                  ) : null}
                </View>
                {esPropietario && (
                  <Pressable onPress={() => eliminarLote(l)} style={{ padding: 6 }}>
                    <Ionicons name="trash-outline" size={15} color={COLORS.ink400} />
                  </Pressable>
                )}
              </View>
            ))
          )}

          {esPropietario && (
            <View style={styles.loteForm}>
              {errorLote ? <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{errorLote}</Text></View> : null}
              <View style={styles.rowStart}>
                <TextInput
                  style={[styles.input, { flex: 1 }]} placeholderTextColor={COLORS.ink400}
                  placeholder="Nombre (ej: Lote 1)" value={nuevoLote.nombre}
                  onChangeText={(v) => setNuevoLote((p) => ({ ...p, nombre: v }))}
                />
                <TextInput
                  style={[styles.input, { flex: 1, marginLeft: 8 }]} placeholderTextColor={COLORS.ink400}
                  placeholder="Cultivo (opcional)" value={nuevoLote.cultivo}
                  onChangeText={(v) => setNuevoLote((p) => ({ ...p, cultivo: v }))}
                />
              </View>
              <View style={[styles.wrapRow, { marginTop: 8 }]}>
                {UNIDADES_TAMANO.map((u) => (
                  <Pressable
                    key={u.val}
                    onPress={() => setNuevoLote((p) => ({ ...p, unidad_tamano: u.val }))}
                    style={[styles.modChip, nuevoLote.unidad_tamano === u.val && styles.modChipActivo]}
                  >
                    <Text style={[styles.modChipText, nuevoLote.unidad_tamano === u.val && styles.modChipTextActivo]}>{u.label}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={[styles.input, { marginTop: 8 }]} placeholderTextColor={COLORS.ink400}
                placeholder={`Tamaño en ${UNIDADES_TAMANO.find((u) => u.val === nuevoLote.unidad_tamano)?.sufijo || ''} (opcional)`}
                keyboardType="decimal-pad" value={nuevoLote.tamano}
                onChangeText={(v) => setNuevoLote((p) => ({ ...p, tamano: v }))}
              />
              <Pressable onPress={crearLote} disabled={creandoLote} style={styles.btnPrimarySmall}>
                {creandoLote ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnPrimarySmallText}>+ Agregar lote</Text>}
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>👥 Equipo de la finca</Text>
          <Text style={styles.cardHint}>Separación de funciones: el auxiliar registra en campo, el administrador gestiona, el propietario controla y cierra.</Text>
          {usuarios.map((u) => (
            <View key={u.id} style={styles.userRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userNombre}>{u.rol_finca === 'propietario' ? '🛡️ ' : ''}{u.nombre_completo}</Text>
                <Text style={styles.userCelular}>{u.celular}</Text>
              </View>
              <Text style={styles.rolBadge}>{ROLES_LABEL[u.rol_finca]}</Text>
              {esPropietario && u.rol_finca !== 'propietario' && (
                <Pressable onPress={() => quitar(u)} style={{ padding: 6 }}><Ionicons name="trash-outline" size={15} color={COLORS.ink400} /></Pressable>
              )}
            </View>
          ))}

          {esPropietario && (
            <View style={styles.equipoForm}>
              {credenciales && (
                <View style={styles.credBox}>
                  <Text style={styles.credTitle}>🔑 Cuenta creada para {credenciales.nombre}</Text>
                  <Text style={styles.credHint}>Comparte estos datos por WhatsApp o de viva voz.</Text>
                  <Text style={styles.credLine}>Usuario (celular): {credenciales.celular}</Text>
                  <Text style={styles.credLine}>Contraseña: {credenciales.password}</Text>
                  <View style={[styles.rowStart, { gap: 8, marginTop: 8 }]}>
                    <Pressable onPress={compartirCredenciales} style={styles.btnPrimarySmall}><Ionicons name="share-outline" size={13} color="#fff" /><Text style={styles.btnPrimarySmallText}>  Compartir</Text></Pressable>
                    <Pressable onPress={() => setCredenciales(null)} style={styles.btnGhostSmall}><Text style={styles.btnGhostSmallText}>Cerrar</Text></Pressable>
                  </View>
                </View>
              )}

              <View style={[styles.rowStart, { gap: 8, marginTop: 10 }]}>
                <Pressable onPress={() => { setModoInvitar('crear'); setErrorEquipo(''); }} style={[styles.modeChip, modoInvitar === 'crear' && styles.modeChipActivo]}>
                  <Text style={[styles.modeChipText, modoInvitar === 'crear' && styles.modeChipTextActivo]}>Crear cuenta</Text>
                </Pressable>
                <Pressable onPress={() => { setModoInvitar('existente'); setErrorEquipo(''); }} style={[styles.modeChip, modoInvitar === 'existente' && styles.modeChipActivo]}>
                  <Text style={[styles.modeChipText, modoInvitar === 'existente' && styles.modeChipTextActivo]}>Ya tiene cuenta</Text>
                </Pressable>
              </View>

              {errorEquipo ? <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{errorEquipo}</Text></View> : null}

              {modoInvitar === 'crear' ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.cardHint}>Tú eliges el celular y la contraseña; el capataz no necesita registrarse.</Text>
                  <Campo label="Nombre del capataz"><TextInput placeholderTextColor={COLORS.ink400} style={styles.input} value={nueva.nombre_completo} onChangeText={(v) => setNueva((p) => ({ ...p, nombre_completo: v }))} placeholder="Ej: Carlos Ramírez" /></Campo>
                  <Campo label="Celular (será su usuario)"><TextInput placeholderTextColor={COLORS.ink400} style={styles.input} keyboardType="phone-pad" value={nueva.celular} onChangeText={(v) => setNueva((p) => ({ ...p, celular: v.replace(/\D/g, '') }))} placeholder="3001234567" /></Campo>
                  <Text style={styles.fieldLabel}>Rol</Text>
                  <View style={styles.wrapRow}>
                    {['administrador', 'auxiliar', 'contador'].map((r) => (
                      <Pressable key={r} onPress={() => setNueva((p) => ({ ...p, rol_finca: r }))} style={[styles.modeChip, nueva.rol_finca === r && styles.modeChipActivo]}>
                        <Text style={[styles.modeChipText, nueva.rol_finca === r && styles.modeChipTextActivo]}>{ROLES_LABEL[r]}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.fieldLabel}>Contraseña</Text>
                  <View style={styles.rowStart}>
                    <TextInput placeholderTextColor={COLORS.ink400} style={[styles.input, { flex: 1 }]} value={nueva.password} onChangeText={(v) => setNueva((p) => ({ ...p, password: v }))} />
                    <Pressable onPress={() => setNueva((p) => ({ ...p, password: generarPassword() }))} style={styles.regenBtn}><Ionicons name="refresh" size={15} color={COLORS.ink700} /></Pressable>
                  </View>
                  <Pressable onPress={crearCuenta} disabled={creando} style={styles.btnPrimary}>
                    {creando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Crear cuenta</Text>}
                  </Pressable>
                </View>
              ) : (
                <View style={{ marginTop: 8 }}>
                  <Campo label="Celular del usuario (ya registrado)"><TextInput placeholderTextColor={COLORS.ink400} style={styles.input} value={inv.celular} onChangeText={(v) => setInv((p) => ({ ...p, celular: v }))} placeholder="3001234567" /></Campo>
                  <Text style={styles.fieldLabel}>Rol</Text>
                  <View style={styles.wrapRow}>
                    {['auxiliar', 'administrador', 'contador'].map((r) => (
                      <Pressable key={r} onPress={() => setInv((p) => ({ ...p, rol_finca: r }))} style={[styles.modeChip, inv.rol_finca === r && styles.modeChipActivo]}>
                        <Text style={[styles.modeChipText, inv.rol_finca === r && styles.modeChipTextActivo]}>{ROLES_LABEL[r]}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable onPress={invitar} style={styles.btnPrimary}><Text style={styles.btnPrimaryText}>Invitar</Text></Pressable>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Campo({ label, children }) {
  return <View style={{ marginTop: 8 }}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.ink900 },
  headerSub: { fontSize: 11, color: COLORS.ink500 },
  auditBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  auditBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.ink700 },
  container: { padding: 16, paddingBottom: 120 },
  rowStart: { flexDirection: 'row', alignItems: 'center' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoBanner: { backgroundColor: COLORS.infoSoft, borderRadius: 10, padding: 10, marginBottom: 12 },
  infoBannerText: { fontSize: 12, fontWeight: '600', color: COLORS.info },
  okBanner: { backgroundColor: COLORS.primarySoft, borderRadius: 10, padding: 10, marginBottom: 12 },
  okBannerText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  errorBanner: { backgroundColor: COLORS.dangerSoft, borderRadius: 10, padding: 10, marginTop: 8 },
  errorBannerText: { fontSize: 12, fontWeight: '600', color: COLORS.danger },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, padding: 16, marginBottom: 14 },
  cardTitle: { fontWeight: '800', fontSize: 14, color: COLORS.ink900 },
  cardHint: { fontSize: 11, color: COLORS.ink500, marginTop: 2, marginBottom: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase', marginBottom: 4, marginTop: 6 },
  input: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: COLORS.ink900, backgroundColor: '#fff' },
  modChip: { flex: 1, minWidth: '45%', padding: 10, borderRadius: 10, borderWidth: 2, borderColor: COLORS.line },
  modChipActivo: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  modChipText: { fontSize: 12, fontWeight: '700', color: COLORS.ink700 },
  modChipTextActivo: { color: COLORS.primary },
  ejemploBox: { backgroundColor: COLORS.lineLight, borderRadius: 10, padding: 10, marginTop: 10 },
  ejemploText: { fontSize: 11, color: COLORS.ink700 },
  btnPrimary: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 14 },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  btnPrimarySmall: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  btnPrimarySmallText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  btnGhostSmall: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  btnGhostSmallText: { fontSize: 12, fontWeight: '700', color: COLORS.ink700 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: COLORS.lineLight, gap: 8 },
  userNombre: { fontWeight: '700', fontSize: 13, color: COLORS.ink900 },
  userCelular: { fontSize: 11, color: COLORS.ink400 },
  emptyLotesText: { fontSize: 12, color: COLORS.ink400, fontStyle: 'italic', marginTop: 4 },
  loteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: COLORS.lineLight, gap: 8 },
  loteForm: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: COLORS.line },
  rolBadge: { fontSize: 11, fontWeight: '700', color: COLORS.ink700, backgroundColor: COLORS.lineLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  equipoForm: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: COLORS.line },
  credBox: { backgroundColor: COLORS.primarySoft, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(0,141,73,0.25)' },
  credTitle: { fontWeight: '800', fontSize: 13, color: COLORS.primary },
  credHint: { fontSize: 11, color: COLORS.ink600, marginTop: 4, marginBottom: 6 },
  credLine: { fontSize: 12, fontFamily: 'monospace', color: COLORS.ink900 },
  modeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff' },
  modeChipActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modeChipText: { fontSize: 11, fontWeight: '700', color: COLORS.ink700 },
  modeChipTextActivo: { color: '#fff' },
  regenBtn: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, padding: 10, marginLeft: 6 },
});
