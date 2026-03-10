const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'terraempleo/fotos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
    resource_type: 'image',
  },
});

const storageVacantes = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'terraempleo/vacantes',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
    resource_type: 'image',
  },
});

const storageHojasVida = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'terraempleo/hojas_vida',
    allowed_formats: ['pdf'],
    resource_type: 'raw',
  },
});

module.exports = { cloudinary, storage, storageVacantes, storageHojasVida };
