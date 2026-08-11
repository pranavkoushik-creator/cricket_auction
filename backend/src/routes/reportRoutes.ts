import { Router, Request, Response } from 'express';
import { getAuctionReport } from '../services/reportService';

const router = Router();

// Public / Spectator accessible report route
router.get('/auction', (req: Request, res: Response) => {
  try {
    const tournamentId = (req.query.tournamentId as string) || 'tour-ipl-2026';
    const report = getAuctionReport(tournamentId);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
