import type { NextFunction, Request, Response } from "express";

export interface AppError extends Error {
  status?: number;
  code?: string;
  errors?: Record<string, string[]>;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.status ?? 500;
  const message = status < 500 ? err.message : "Internal server error";

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    message,
    ...(err.code ? { code: err.code } : {}),
    ...(err.errors ? { errors: err.errors } : {}),
  });
}

export function createError(message: string, status = 500, code?: string): AppError {
  const error: AppError = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}
