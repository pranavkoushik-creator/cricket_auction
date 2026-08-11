import { Router, Request, Response } from 'express';
import { getFranchises, getFranchiseById, createFranchise, updateFranchise, deleteFranchise } from '../services/franchiseService';
import { getFranchisePurse } from '../services/purseLedgerService';
import { authenticate } from '../middleware/authMiddleware';
import { authorize, guardFranchiseOwnership } from '../middleware/roleMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', authorize('Super Admin', 'Franchise Owner', 'Player'), (req: Request, res: Response) => {
  try {
    const tournamentId = (req.query.tournamentId as string) || 'tour-ipl-2026';
    const list = getFranchises(tournamentId);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authorize('Super Admin', 'Franchise Owner', 'Player'), (req: Request, res: Response) => {
  try {
    const item = getFranchiseById(req.params.id as string);
    res.json(item);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/', authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const item = createFranchise(req.body);
    res.json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', authorize('Super Admin', 'Franchise Owner'), guardFranchiseOwnership, (req: Request, res: Response) => {
  try {
    const item = updateFranchise(req.params.id as string, req.body);
    res.json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const result = deleteFranchise(req.params.id as string);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/purse', authorize('Super Admin', 'Franchise Owner', 'Player'), guardFranchiseOwnership, (req: Request, res: Response) => {
  try {
    const purse = getFranchisePurse(req.params.id as string);
    res.json(purse);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

export default router;

