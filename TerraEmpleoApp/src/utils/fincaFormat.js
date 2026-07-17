export function formatMoney(v) {
  const n = Number(v) || 0;
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}

export function formatDate(ymd) {
  if (!ymd) return '';
  const s = String(ymd).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(d)} ${meses[Number(m) - 1] || ''} ${y}`;
}

// Algunos campos (p.ej. titulo de vacante) pueden venir como string u objeto
// según el endpoint — normaliza siempre a texto plano para renderizar.
export function asText(v) {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  return v.titulo || v.nombre || v.nombre_completo || '';
}
