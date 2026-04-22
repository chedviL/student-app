import type { Student } from "../types/student";

export function getFullName(student: Student): string {
  return `${student.firstName} ${student.lastName}`;
}
