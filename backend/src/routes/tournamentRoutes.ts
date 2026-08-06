import { Router, Request, Response } from 'express';
import { getTournaments, getTournamentById, createTournament, updateTournamentRules, updateTournamentStatus } from '../services/tournamentService';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const list = getTournaments();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const item = getTournamentById(req.params.id);
    res.json(item);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const item = createTournament(req.body);
    res.json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/rules', (req: Request, res: Response) => {
  try {
    const item = updateTournamentRules(req.params.id, req.body);
    res.json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/status', (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const item = updateTournamentStatus(req.params.id, status);
    res.json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
