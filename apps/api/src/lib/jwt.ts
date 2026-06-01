import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";

export interface AccessTokenPayload {
  sub: string;
  role: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, process.env["JWT_SECRET"]!, {
    expiresIn: (process.env["JWT_EXPIRES_IN"] ?? "15m") as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, process.env["JWT_SECRET"]!) as AccessTokenPayload;
}

export function generateRefreshToken(): string {
  return randomBytes(40).toString("hex");
}
