const { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const multerS3 = require('multer-s3');
require('dotenv').config();

// Validar credenciales AWS al iniciar
const awsRegion = process.env.AWS_REGION;
const awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
const bucket = process.env.AWS_S3_BUCKET;

if (!awsRegion || !awsAccessKey || !awsSecretKey || !bucket) {
  const missing = [];
  if (!awsRegion) missing.push('AWS_REGION');
  if (!awsAccessKey) missing.push('AWS_ACCESS_KEY_ID');
  if (!awsSecretKey) missing.push('AWS_SECRET_ACCESS_KEY');
  if (!bucket) missing.push('AWS_S3_BUCKET');
  console.error(`[S3] ERROR: Variables de entorno faltantes: ${missing.join(', ')}`);
  console.error('[S3] Las funciones de almacenamiento S3 no funcionarán correctamente.');
}

const s3 = new S3Client({
  region: awsRegion,
  credentials: {
    accessKeyId: awsAccessKey,
    secretAccessKey: awsSecretKey,
  },
});

// ── Multer storages (privado, sin ACL) ──

const storage = multerS3({
  s3,
  bucket,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `fotos/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`);
  },
});

const storageVacantes = multerS3({
  s3,
  bucket,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `vacantes/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`);
  },
});

const storageHojasVida = multerS3({
  s3,
  bucket,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req, file, cb) => {
    cb(null, `hojas_vida/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.pdf`);
  },
});

const storageFotosTrabajo = multerS3({
  s3,
  bucket,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `fotos_trabajo/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`);
  },
});

const storageFinanzas = multerS3({
  s3,
  bucket,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req, file, cb) => {
    const ext = file.originalname.split('.').pop();
    cb(null, `finanzas/facturas/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`);
  },
});

const storageChat = multerS3({
  s3,
  bucket,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const tipo = file.mimetype.startsWith('audio') ? 'audios' : 'imagenes';
    cb(null, `chat/${tipo}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`);
  },
});

// ── Pre-signed URLs ──

const URL_EXPIRY = 3600; // 1 hora

// Extrae la key de S3 de una URL completa
function extractKey(fileUrl) {
  try {
    const url = new URL(fileUrl);
    if (url.hostname.includes(bucket)) {
      return decodeURIComponent(url.pathname.substring(1));
    }
    return decodeURIComponent(url.pathname.split('/').slice(2).join('/'));
  } catch {
    return null;
  }
}

// Firma una URL de S3, retorna pre-signed URL. Si no es S3, retorna tal cual.
async function signUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return fileUrl;
  if (!fileUrl.includes('amazonaws.com')) return fileUrl;

  const key = extractKey(fileUrl);
  if (!key) return fileUrl;

  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, command, { expiresIn: URL_EXPIRY });
}

// Firma múltiples campos de un objeto
async function signFields(obj, fields) {
  if (!obj) return obj;
  for (const field of fields) {
    if (obj[field]) {
      obj[field] = await signUrl(obj[field]);
    }
  }
  return obj;
}

// Firma URLs en un array de objetos con un campo específico
async function signArrayField(arr, field) {
  if (!arr || !Array.isArray(arr)) return arr;
  for (const item of arr) {
    if (item[field]) {
      item[field] = await signUrl(item[field]);
    }
  }
  return arr;
}

// ── Subida directa de un Buffer (p. ej. imágenes recibidas por WhatsApp) ──
const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * Sube un Buffer a S3 bajo un prefijo y devuelve la URL pública (privada, se firma al leer).
 * @returns {Promise<string|null>} URL del objeto o null si falla.
 */
async function subirBuffer(buffer, prefijo = 'vacantes', contentType = 'image/jpeg') {
  if (!buffer || !buffer.length) return null;
  const ext = EXT_BY_MIME[contentType] || 'jpg';
  const key = `${prefijo}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
  try {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }));
    return `https://${bucket}.s3.${awsRegion}.amazonaws.com/${key}`;
  } catch (err) {
    console.error('[S3] subirBuffer error:', err.message);
    return null;
  }
}

// ── Delete ──

async function deleteFromS3(fileUrl) {
  if (!fileUrl) return;
  try {
    const key = extractKey(fileUrl);
    if (key) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    }
  } catch (err) {
    console.error('Error eliminando de S3:', err.message);
  }
}

module.exports = {
  s3,
  storage,
  storageVacantes,
  storageHojasVida,
  storageFotosTrabajo,
  storageChat,
  storageFinanzas,
  deleteFromS3,
  subirBuffer,
  signUrl,
  signFields,
  signArrayField,
};
