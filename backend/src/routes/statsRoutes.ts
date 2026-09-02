import { Router, Request, Response } from 'express';
import {
  getPlayerStats,
  getPlayerLeaderboard,
  getMatchHistory,
  getMatchScorecard
} from '../services/playerStatsService';
import { authenticate } from '../middleware/authMiddleware';
import { authorize } from '../middleware/roleMiddleware';

const router = Router();

router.use(authenticate);

const READERS = ['Super Admin', 'Franchise Owner', 'Player'] as const;
const tournamentOf = (req: Request) => (req.query.tournamentId as string) || 'tour-ipl-2026';

/** Leaderboard across the tournament: one row per squad player. */
router.get('/players', authorize(...READERS), (req: Request, res: Response) => {
  try {
    res.json(getPlayerLeaderboard(tournamentOf(req)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** Career totals plus every individual innings for one player. */
router.get('/players/:id', authorize(...READERS), (req: Request, res: Response) => {
  try {
    res.json(getPlayerStats(req.params.id as string, tournamentOf(req)));
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

/** Matches played or under way, newest first. */
router.get('/matches', authorize(...READERS), (req: Request, res: Response) => {
  try {
    res.json(getMatchHistory(tournamentOf(req)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** The stored record of one match: both innings in full. */
router.get('/matches/:id', authorize(...READERS), (req: Request, res: Response) => {
  try {
    res.json(getMatchScorecard(req.params.id as string));
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

export default router;
