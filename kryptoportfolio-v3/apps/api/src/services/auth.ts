import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  // bcryptjs is sync internally; wrap for consistent API
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function newId(prefix?: string) {
  const id = randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}
