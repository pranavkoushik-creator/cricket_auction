import { Router, Request, Response } from 'express';
import { registerUser, loginUser, createFranchiseOwner, verifyTokenAndGetUser, getAllUsers, setUserTournamentRole } from '../services/authService';
import { authenticate } from '../middleware/authMiddleware';
import { authorize } from '../middleware/roleMiddleware';

const router = Router();

// Public Authentication Endpoints
router.post('/register', (req: Request, res: Response) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    const result = registerUser(name, email, password, phone);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const result = loginUser(email, password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// Protected Endpoints
router.get('/me', authenticate, (req: Request, res: Response) => {
  res.json(req.user);
});

// Admin-Only Endpoints
router.post('/create-owner', authenticate, authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Owner name and email are required.' });
    }
    const result = createFranchiseOwner(name, email, password, phone);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/users', authenticate, authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const users = getAllUsers();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:id/roles', authenticate, authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const { tournamentId, role } = req.body;
    if (!tournamentId || !role) {
      return res.status(400).json({ error: 'tournamentId and role are required.' });
    }
    const result = setUserTournamentRole(req.params.id as string, tournamentId, role);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
