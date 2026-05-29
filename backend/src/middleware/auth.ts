import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'dealer-portal-secret-key-2024';

export interface AuthRequest extends Request {
  user?: any;
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function generateToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}
