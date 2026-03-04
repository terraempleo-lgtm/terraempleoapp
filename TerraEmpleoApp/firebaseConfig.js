// firebaseConfig.js
// Coloca este archivo en la raíz de tu proyecto o en /src/config/

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAITuMFp0tWkYH0gLCHIN91APNTS2G3Z14",
  authDomain: "terraempleo-737ce.firebaseapp.com",
  projectId: "terraempleo-737ce",
  storageBucket: "terraempleo-737ce.firebasestorage.app",
  messagingSenderId: "531810917611",
  appId: "1:531810917611:web:08598c1bc8357cdb4732ae",
  measurementId: "G-VGSHL3V4DK"
};

// Evita inicializar Firebase más de una vez
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export default app;