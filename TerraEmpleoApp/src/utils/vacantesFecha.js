export function normalizarFechaInput(valor) {
  if (typeof valor !== 'string') return '';

  const limpio = valor.replace(/[^0-9-]/g, '').slice(0, 10);
  const partes = limpio.split('-').slice(0, 3);

  if (partes.length === 0) return '';

  const yyyy = (partes[0] || '').slice(0, 4);
  const mm = (partes[1] || '').slice(0, 2);
  const dd = (partes[2] || '').slice(0, 2);

  return [yyyy, mm, dd].filter((p, index) => p || index === 0).join('-');
}

function parsearFechaVacante(fecha) {
  if (!fecha || typeof fecha !== 'string') return null;

  const base = fecha.trim().slice(0, 10);
  const match = base.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day, date };
}

export function getFechaInicioInputValue(fecha) {
  const parsed = parsearFechaVacante(fecha);
  if (!parsed) return '';

  return `${parsed.year.toString().padStart(4, '0')}-${parsed.month
    .toString()
    .padStart(2, '0')}-${parsed.day.toString().padStart(2, '0')}`;
}

export function getFechaInicioPayload(fecha) {
  const inputValue = getFechaInicioInputValue(fecha);
  return inputValue || null;
}

export function formatVacancyStartDate(fechaInicio, options = {}) {
  const { long = false, fallback = '' } = options;
  const parsed = parsearFechaVacante(fechaInicio);

  if (!parsed) return fallback;

  const formato = long
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : { day: 'numeric', month: 'short', year: 'numeric' };

  return parsed.date
    .toLocaleDateString('es-CO', formato)
    .replace('.', '')
    .toLowerCase();
}
