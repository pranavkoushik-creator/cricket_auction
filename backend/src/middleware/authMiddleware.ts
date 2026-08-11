import { Request, Response, NextFunction } from 'express';
import { verifyTokenAndGetUser } from '../services/authService';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  role: string;
  franchise_id?: string | null;
  franchise_name?: string | null;
  franchise_short?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '401 Unauthorized: Authorization token missing or malformed.' });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({ error: '401 Unauthorized: Bearer token is empty.' });
    }

    const user = verifyTokenAndGetUser(token);
    req.user = user;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: `401 Unauthorized: ${err.message}` });
  }
}
