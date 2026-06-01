import type { NextFunction, Request, Response } from "express";
import { type ZodSchema, ZodError } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".");
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      res.status(422).json({ message: "Validation failed", errors });
      return;
    }
    req.body = result.data;
    next();
  };
}
