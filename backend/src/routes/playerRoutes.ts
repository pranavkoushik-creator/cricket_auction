import { Router, Request, Response } from 'express';
import { getPlayers, registerPlayer, updatePlayerApprovalStatus } from '../services/playerService';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const tournamentId = (req.query.tournamentId as string) || 'tour-ipl-2026';
    const status = req.query.status as string;
    const players = getPlayers(tournamentId, status);
    res.json(players);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const player = registerPlayer(req.body);
    res.json(player);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/approve', (req: Request, res: Response) => {
  try {
    const player = updatePlayerApprovalStatus(req.params.id as string, 'approved', req.body.reason);
    res.json(player);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/reject', (req: Request, res: Response) => {
  try {
    const player = updatePlayerApprovalStatus(req.params.id as string, 'rejected', req.body.reason);
    res.json(player);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/request-changes', (req: Request, res: Response) => {
  try {
    const player = updatePlayerApprovalStatus(req.params.id as string, 'changes_requested', req.body.reason);
    res.json(player);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/suspend', (req: Request, res: Response) => {
  try {
    const player = updatePlayerApprovalStatus(req.params.id as string, 'suspended', req.body.reason);
    res.json(player);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
