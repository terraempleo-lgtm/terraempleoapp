const FRECUENCIA_LABELS = {
  jornal: 'por día',
  semanal: 'por semana',
  quincenal: 'por quincena',
  mensual: 'por mes',
  destajo: 'por tarea',
};

const TIPO_PAGO_LABELS = {
  jornal: 'Jornal',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
  destajo: 'Destajo',
};

function extraerSoloDigitos(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor).replace(/\D/g, '');
}

export function formatearMontoInput(valor) {
  const limpio = extraerSoloDigitos(valor);
  if (!limpio) return '';
  return Number(limpio).toLocaleString('es-CO');
}

export function normalizarMontoPayload(valor) {
  const limpio = extraerSoloDigitos(valor);
  if (!limpio) return null;

  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

export function getVacancyPayDisplay(vacante) {
  const monto = Number(vacante?.monto_pago);
  const tipoPago = vacante?.tipo_pago || '';

  if (!Number.isFinite(monto) || monto <= 0) {
    return {
      valor: 'A convenir',
      tipoLabel: TIPO_PAGO_LABELS[tipoPago] || null,
    };
  }

  const montoTexto = `$${monto.toLocaleString('es-CO')}`;
  const frecuencia = FRECUENCIA_LABELS[tipoPago];

  return {
    valor: frecuencia ? `${montoTexto} ${frecuencia}` : montoTexto,
    tipoLabel: TIPO_PAGO_LABELS[tipoPago] || null,
  };
}
