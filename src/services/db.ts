import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

// --- WEB STORAGE KEYS ---
const USERS_KEY = "terraempleo_users_v1";
const VACANCIES_KEY = "terraempleo_vacancies_v1";

// --- TYPES ---
export type UserRow = {
  id: number;
  nombre: string;
  ubicacion: string;
  cedula: string;
  celular: string;
  role: string;
  skillsJson: string; // JSON string: '["siembra","poda","otro:..."]'
  createdAt: number;
};

export type VacancyRow = {
  id: number;
  title: string;
  description: string;
  pay: string;
  location: string;
  createdAt: number;
  createdByUserId?: number;
};

// --- WEB HELPERS: generic safe read/write ---
async function webRead<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function webWrite(key: string, value: any): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// --- WEB HELPERS: USERS ---
async function webReadUsers(): Promise<UserRow[]> {
  const v = await webRead<UserRow[]>(USERS_KEY, []);
  return Array.isArray(v) ? v : [];
}

async function webWriteUsers(users: UserRow[]): Promise<void> {
  await webWrite(USERS_KEY, users);
}

// --- WEB HELPERS: VACANCIES ---
async function webReadVacancies(): Promise<VacancyRow[]> {
  const v = await webRead<VacancyRow[]>(VACANCIES_KEY, []);
  return Array.isArray(v) ? v : [];
}

async function webWriteVacancies(vacancies: VacancyRow[]): Promise<void> {
  await webWrite(VACANCIES_KEY, vacancies);
}

// --- NATIVE SQLITE (solo iOS/Android) ---
// Import dinámico para no romper en web
let db: any = null;

function getNativeDB() {
  if (isWeb) return null;
  if (db) return db;

  const SQLite = require("expo-sqlite");
  db = SQLite.openDatabaseSync("terraempleo.db");
  return db;
}

async function executeSql(sql: string, params: any[] = []): Promise<any> {
  if (isWeb) throw new Error("SQLite no está disponible en Web.");

  const nativeDb = getNativeDB();

  if (nativeDb && typeof nativeDb.runAsync === "function") {
    return nativeDb.runAsync(sql, params);
  }
  if (nativeDb && typeof nativeDb.runSync === "function") {
    return nativeDb.runSync(sql, params);
  }

  throw new Error("DB native no soporta runAsync/runSync.");
}

// --- INIT DB ---
export async function initDB(): Promise<void> {
  if (isWeb) {
    // aseguramos llaves existentes sin lógica rara
    const users = await webReadUsers();
    const vacancies = await webReadVacancies();
    await webWriteUsers(users);
    await webWriteVacancies(vacancies);
    return;
  }

  const createUsers = `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    ubicacion TEXT NOT NULL,
    cedula TEXT NOT NULL,
    celular TEXT NOT NULL,
    role TEXT NOT NULL,
    skillsJson TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  );`;

  const createVacancies = `CREATE TABLE IF NOT EXISTS vacancies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    pay TEXT NOT NULL,
    location TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    createdByUserId INTEGER
  );`;

  await executeSql(createUsers);
  await executeSql(createVacancies);

  // Nota: si ya creaste users antes SIN skillsJson, esto no la agrega.
  // Migración simple (solo si falta):
  await tryAddColumnUsersSkillsJson();
}

// Migración segura: agrega skillsJson si no existe
async function tryAddColumnUsersSkillsJson(): Promise<void> {
  if (isWeb) return;

  try {
    // PRAGMA table_info devuelve columnas
    const nativeDb = getNativeDB();
    if (nativeDb && typeof nativeDb.getAllAsync === "function") {
      const cols = await nativeDb.getAllAsync("PRAGMA table_info(users);");
      const has =
        Array.isArray(cols) && cols.some((c: any) => c?.name === "skillsJson");
      if (!has)
        await executeSql(
          "ALTER TABLE users ADD COLUMN skillsJson TEXT NOT NULL DEFAULT '[]';",
        );
      return;
    }

    // Fallback: intenta ALTER directo (si existe, puede fallar)
    await executeSql(
      "ALTER TABLE users ADD COLUMN skillsJson TEXT NOT NULL DEFAULT '[]';",
    );
  } catch {
    // si falla, normalmente es porque ya existe; no hacemos nada
  }
}

// --- USERS ---
export async function insertUser(
  nombre: string,
  ubicacion: string,
  cedula: string,
  celular: string,
  role: string,
  skills: string[] = [],
): Promise<number> {
  await initDB();
  const createdAt = Date.now();
  const skillsJson = JSON.stringify(skills ?? []);

  if (isWeb) {
    const users = await webReadUsers();
    const nextId = users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1;

    users.unshift({
      id: nextId,
      nombre,
      ubicacion,
      cedula,
      celular,
      role,
      skillsJson,
      createdAt,
    });

    await webWriteUsers(users);
    return nextId;
  }

  const insertSql =
    "INSERT INTO users (nombre, ubicacion, cedula, celular, role, skillsJson, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?);";

  const result = await executeSql(insertSql, [
    nombre,
    ubicacion,
    cedula,
    celular,
    role,
    skillsJson,
    createdAt,
  ]);

  const id = result?.lastInsertRowId ?? result?.insertId ?? -1;
  return typeof id === "number" ? id : -1;
}

export async function getUsers(): Promise<UserRow[]> {
  await initDB();

  if (isWeb) {
    const users = await webReadUsers();
    return users.sort((a, b) => b.createdAt - a.createdAt);
  }

  const nativeDb = getNativeDB();

  if (nativeDb && typeof nativeDb.getAllAsync === "function") {
    const rows = await nativeDb.getAllAsync(
      "SELECT * FROM users ORDER BY createdAt DESC;",
    );
    return Array.isArray(rows) ? rows : [];
  }

  const res = await executeSql("SELECT * FROM users ORDER BY createdAt DESC;");
  if (res?.rows?._array && Array.isArray(res.rows._array))
    return res.rows._array;
  if (Array.isArray(res)) return res;

  return [];
}

// --- VACANCIES ---
export async function insertVacancy(input: {
  title: string;
  description: string;
  pay: string;
  location: string;
  createdByUserId?: number;
}): Promise<number> {
  await initDB();
  const createdAt = Date.now();

  if (isWeb) {
    const vacancies = await webReadVacancies();
    const nextId = vacancies.length
      ? Math.max(...vacancies.map((v) => v.id)) + 1
      : 1;

    vacancies.unshift({
      id: nextId,
      title: input.title.trim(),
      description: input.description.trim(),
      pay: input.pay.trim(),
      location: input.location.trim(),
      createdAt,
      createdByUserId: input.createdByUserId,
    });

    await webWriteVacancies(vacancies);
    return nextId;
  }

  const sql = `INSERT INTO vacancies (title, description, pay, location, createdAt, createdByUserId)
               VALUES (?, ?, ?, ?, ?, ?);`;

  const res = await executeSql(sql, [
    input.title.trim(),
    input.description.trim(),
    input.pay.trim(),
    input.location.trim(),
    createdAt,
    input.createdByUserId ?? null,
  ]);

  const id = res?.lastInsertRowId ?? res?.insertId ?? -1;
  return typeof id === "number" ? id : -1;
}

export async function getVacancies(): Promise<VacancyRow[]> {
  await initDB();

  if (isWeb) {
    const v = await webReadVacancies();
    return v.sort((a, b) => b.createdAt - a.createdAt);
  }

  const nativeDb = getNativeDB();

  if (nativeDb && typeof nativeDb.getAllAsync === "function") {
    const rows = await nativeDb.getAllAsync(
      "SELECT * FROM vacancies ORDER BY createdAt DESC;",
    );
    return Array.isArray(rows) ? rows : [];
  }

  const res = await executeSql(
    "SELECT * FROM vacancies ORDER BY createdAt DESC;",
  );
  if (res?.rows?._array && Array.isArray(res.rows._array))
    return res.rows._array;
  if (Array.isArray(res)) return res;

  return [];
}
