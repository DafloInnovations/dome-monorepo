import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";

export interface AccessTokenPayload {
  sub: string;
  role: string;
}

const ROLE_EXPIRY: Record<string, string> = { VENDOR: "4h", ADMIN: "4h" };

export function signAccessToken(payload: AccessTokenPayload): string {
  const expiry = (ROLE_EXPIRY[payload.role] ?? process.env["JWT_EXPIRES_IN"] ?? "15m") as jwt.SignOptions["expiresIn"];
  return jwt.sign(payload, process.env["JWT_SECRET"]!, { expiresIn: expiry });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, process.env["JWT_SECRET"]!) as AccessTokenPayload;
}

export function generateRefreshToken(): string {
  return randomBytes(40).toString("hex");
}
