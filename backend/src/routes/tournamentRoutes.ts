import { Router, Request, Response } from 'express';
import { getTournaments, getTournamentById, createTournament, updateTournamentRules, updateTournamentStatus } from '../services/tournamentService';
import { authenticate } from '../middleware/authMiddleware';
import { authorize } from '../middleware/roleMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', authorize('Super Admin', 'Franchise Owner', 'Player'), (req: Request, res: Response) => {
  try {
    const list = getTournaments();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authorize('Super Admin', 'Franchise Owner', 'Player'), (req: Request, res: Response) => {
  try {
    const item = getTournamentById(req.params.id as string);
    res.json(item);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/', authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const item = createTournament(req.body);
    res.json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/rules', authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const item = updateTournamentRules(req.params.id as string, req.body);
    res.json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/status', authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const item = updateTournamentStatus(req.params.id as string, status);
    res.json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
