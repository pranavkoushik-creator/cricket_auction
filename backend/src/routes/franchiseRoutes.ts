import { Router, Request, Response } from 'express';
import { getFranchises, getFranchiseById, createFranchise, updateFranchise, deleteFranchise } from '../services/franchiseService';
import { getFranchisePurse } from '../services/purseLedgerService';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const tournamentId = (req.query.tournamentId as string) || 'tour-ipl-2026';
    const list = getFranchises(tournamentId);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const item = getFranchiseById(req.params.id);
    res.json(item);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const item = createFranchise(req.body);
    res.json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const item = updateFranchise(req.params.id, req.body);
    res.json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const result = deleteFranchise(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/purse', (req: Request, res: Response) => {
  try {
    const purse = getFranchisePurse(req.params.id);
    res.json(purse);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

export default router;

