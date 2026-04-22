import type { Student } from "../types/student";

const BASE_URL = "https://script.google.com/macros/s/AKfycbwF9U1nIaDcx2qhe1ErWWACot4ngxlSjjN6FOKsBzgg7xxWSTET1BXLIYLbsrG-Z_Dd/exec";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string | null;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const json: ApiResponse<T> = await response.json();

  if (!json.success) {
    throw new Error(json.error || "Request failed");
  }

  return json.data;
}

export async function getStudents(): Promise<Student[]> {
  const response = await fetch(`${BASE_URL}?action=list`);
  return handleResponse<Student[]>(response);
}

export async function searchStudents(query: string): Promise<Student[]> {
  const response = await fetch(
    `${BASE_URL}?action=search&q=${encodeURIComponent(query)}`
  );
  return handleResponse<Student[]>(response);
}

export async function getStudentById(id: string): Promise<Student | null> {
  const response = await fetch(
    `${BASE_URL}?action=getById&id=${encodeURIComponent(id)}`
  );
  return handleResponse<Student | null>(response);
}