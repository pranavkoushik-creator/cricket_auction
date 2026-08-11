import { Router, Request, Response } from 'express';
import { getPlayers, registerPlayer, updatePlayerApprovalStatus, createSinglePlayer, bulkImportPlayers } from '../services/playerService';
import { authenticate } from '../middleware/authMiddleware';
import { authorize } from '../middleware/roleMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', authorize('Super Admin', 'Franchise Owner', 'Player'), (req: Request, res: Response) => {
  try {
    const tournamentId = (req.query.tournamentId as string) || 'tour-ipl-2026';
    const status = req.query.status as string;
    const players = getPlayers(tournamentId, status);
    res.json(players);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authorize('Super Admin', 'Player'), (req: Request, res: Response) => {
  try {
    const player = registerPlayer(req.body);
    res.json(player);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/create-single', authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const { tournament_id, name, category, role, base_price } = req.body;
    if (!tournament_id || !name || !category || !role || base_price === undefined) {
      return res.status(400).json({ error: 'Tournament ID, Name, Category, Role, and Base Price are required.' });
    }
    const player = createSinglePlayer(req.body);
    res.json(player);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/bulk-import', authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const { tournamentId, players } = req.body;
    if (!tournamentId || !Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ error: 'Tournament ID and a non-empty array of players are required.' });
    }
    const result = bulkImportPlayers(tournamentId, players);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/approve', authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const player = updatePlayerApprovalStatus(req.params.id as string, 'approved', req.body.reason);
    res.json(player);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/reject', authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const player = updatePlayerApprovalStatus(req.params.id as string, 'rejected', req.body.reason);
    res.json(player);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/request-changes', authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const player = updatePlayerApprovalStatus(req.params.id as string, 'changes_requested', req.body.reason);
    res.json(player);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/suspend', authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const player = updatePlayerApprovalStatus(req.params.id as string, 'suspended', req.body.reason);
    res.json(player);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
