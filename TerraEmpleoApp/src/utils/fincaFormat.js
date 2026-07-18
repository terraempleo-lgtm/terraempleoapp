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

// tipo_trabajo/labor queda guardado tal cual se escribió en la jornada — datos
// viejos pueden tener "recoleccion" sin tilde/mayúscula. Normaliza a la
// etiqueta canónica de los chips de labor dondequiera que se muestre.
const LABORES_CANONICAS = [
  'Recolección', 'Desyerba / Guadaña', 'Fumigación', 'Fertilización', 'Poda', 'Siembra',
];
const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const LABOR_POR_CLAVE = new Map(LABORES_CANONICAS.map((l) => [sinAcentos(l), l]));

export function formatLabor(tipo) {
  if (!tipo) return tipo;
  const clave = sinAcentos(tipo);
  if (LABOR_POR_CLAVE.has(clave)) return LABOR_POR_CLAVE.get(clave);
  return tipo;
}
