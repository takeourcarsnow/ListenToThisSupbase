// Simple bcrypt wrapper for browser (uses bcryptjs)
import bcrypt from 'bcryptjs';

export async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

export async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}
