import type { Student } from "../types/student";

const BASE_URL = "https://script.google.com/macros/s/AKfycbwF9U1nIaDcx2qhe1ErWWACot4ngxlSjjN6FOKsBzgg7xxWSTET1BXLIYLbsrG-Z_Dd/exec";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string | null;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const json: ApiResponse<T> = await response.json();
  if (!json.success) throw new Error(json.error || "Request failed");
  return json.data;
}

let studentsCache: Student[] | null = null;
let cacheTime: number | null = null;
const CACHE_TTL = 24 * 60 * 60 * 1000; // יום שלם

export async function getStudents(): Promise<Student[]> {
  const now = Date.now();
  if (studentsCache && cacheTime && now - cacheTime < CACHE_TTL) return studentsCache;
  const response = await fetch(`${BASE_URL}?action=list`);
  studentsCache = await handleResponse<Student[]>(response);
  cacheTime = now;
  return studentsCache;
}

export function clearStudentsCache() {
  studentsCache = null;
  cacheTime = null;
}