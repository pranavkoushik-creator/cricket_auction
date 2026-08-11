import { Request, Response, NextFunction } from 'express';

export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: '401 Unauthorized: User not authenticated.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `403 Forbidden: Access denied. Required role: [${allowedRoles.join(', ')}]. Your role: '${req.user.role}'.`
      });
    }

    next();
  };
}

export function guardFranchiseOwnership(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: '401 Unauthorized: User not authenticated.' });
  }

  // Super Admin bypasses ownership checks
  if (req.user.role === 'Super Admin') {
    return next();
  }

  if (req.user.role === 'Franchise Owner') {
    const targetFranchiseId = req.params.id || req.body.franchise_id || req.query.franchise_id;
    if (targetFranchiseId && targetFranchiseId !== req.user.franchise_id) {
      return res.status(403).json({
        error: `403 Forbidden: Access denied. You are only authorized to interact with your assigned franchise (${req.user.franchise_short || req.user.franchise_id}).`
      });
    }
  }

  next();
}
