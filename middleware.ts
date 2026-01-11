import dotenv from "dotenv"
import jwt from "jsonwebtoken"
import type { JwtPayload } from "jsonwebtoken"
import type { NextFunction, Request, Response } from "express";
import ApiError from "./utils/error";
dotenv.config()

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & {
        userId: string;
        role: "teacher" | "student";
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw ApiError.internal("JWT secret is missing");
}

type Role = "teacher" | "student";

export default function userMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw ApiError.unauthorized();
    }

    const token = authHeader.split(" ")[1];
    if(!token){
        throw ApiError.unauthorized();
    }

    const decoded = jwt.verify(token, JWT_SECRET as string) as unknown as JwtPayload & {
      userId: string;
      role: Role;
    };

    if (!decoded.userId || !decoded.role) {
      throw ApiError.unauthorized("Invalid token payload");
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (
      error instanceof jwt.TokenExpiredError ||
      error instanceof jwt.JsonWebTokenError
    ) {
      return next(ApiError.unauthorized("Invalid or expired token"));
    }
    next(error);
  }
}