// Opciones predefinidas para chips de selección
export const CULTIVOS = [
  'Café', 'Plátano', 'Papa', 'Aguacate', 'Caña de azúcar',
  'Ganadería', 'Caballos', 'Peces (piscicultura)', 'Frijol', 'Tomate',
  'Flores', 'Arroz', 'Maíz', 'Yuca', 'Cacao',
  'Palma de aceite', 'Frutas cítricas', 'Banano', 'Piña', 'Mango',
];

export const LABORES = [
  'Recolección', 'Fumigación', 'Poda', 'Siembra', 'Riego',
  'Mayordomo', 'Empaque', 'Transporte', 'Mantenimiento general',
  'Ganadería', 'Administración de finca', 'Ordeño', 'Cercado',
  'Manejo de maquinaria', 'Cuidado de animales',
];

export const NIVELES_ESTUDIO = [
  { label: 'Sin estudios', value: 'sin_estudios' },
  { label: 'Bachiller', value: 'bachiller' },
  { label: 'Técnico / Tecnólogo', value: 'tecnico_tecnologo' },
  { label: 'Universitario', value: 'universitario' },
];

export const TITULOS_SUGERIDOS = [
  'Técnico agropecuario', 'Tecnólogo agroindustrial', 'Técnico en producción animal',
  'Tecnólogo en gestión de empresas agropecuarias', 'Ingeniero agrónomo',
  'Ingeniero ambiental', 'Médico veterinario', 'Zootecnista',
  'Administrador de empresas agropecuarias', 'Técnico en cultivos',
  'Tecnólogo en recursos naturales', 'Técnico en maquinaria agrícola',
];

export const EXPERIENCIA_OPTIONS = [
  { label: 'Sin experiencia', value: 'sin' },
  { label: 'Menos de 1 año', value: 'menos_1' },
  { label: '1 a 3 años', value: '1_3' },
  { label: '3 a 5 años', value: '3_5' },
  { label: '5 a 10 años', value: '5_10' },
  { label: 'Más de 10 años', value: 'mas_10' },
];

export const DISPONIBILIDAD_OPTIONS = [
  { label: 'Tiempo completo', value: 'tiempo_completo' },
  { label: 'Por días', value: 'por_dias' },
  { label: 'Temporada / Cosecha', value: 'temporada_cosecha' },
  { label: 'Fines de semana', value: 'fines_semana' },
  { label: 'Disponible inmediatamente', value: 'disponible_inmediatamente' },
];

export const TIPO_PAGO_OPTIONS = [
  { label: 'Jornal (diario)', value: 'jornal' },
  { label: 'Semanal', value: 'semanal' },
  { label: 'Quincenal', value: 'quincenal' },
  { label: 'Mensual', value: 'mensual' },
  { label: 'Por tarea / Destajo', value: 'destajo' },
];
