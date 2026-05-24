import bcrypt from "bcryptjs";

import UserModel, { type UserRole } from "@/models/User";

const PASSWORD_SALT_ROUNDS = 10;

type SessionUserInput = {
  _id: { toString(): string };
  email: string;
  name: string;
  image?: string | null;
  role: UserRole;
};

export function normalizeUserEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function findActiveUserByEmail(email: string) {
  return UserModel.findOne({
    email: normalizeUserEmail(email),
    isActive: true,
  });
}

export async function hashUserPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export async function verifyUserPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function buildSessionUser(user: SessionUserInput) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    image: user.image ?? undefined,
    role: user.role,
  };
}
