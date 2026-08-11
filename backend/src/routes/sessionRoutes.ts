import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { authenticate } from '../middleware/authMiddleware';
import { authorize } from '../middleware/roleMiddleware';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.use(authenticate);

router.get('/', authorize('Super Admin', 'Franchise Owner', 'Player'), (req: Request, res: Response) => {
  try {
    const tournamentId = (req.query.tournamentId as string) || 'tour-ipl-2026';
    let session = db.prepare('SELECT * FROM auction_sessions WHERE tournament_id = ?').get(tournamentId) as any;

    if (!session) {
      const sesId = `ses-${uuidv4().substring(0, 8)}`;
      db.prepare('INSERT INTO auction_sessions (id, tournament_id, status, timer_seconds, timer_enabled) VALUES (?, ?, "scheduled", 15, 1)').run(sesId, tournamentId);
      session = db.prepare('SELECT * FROM auction_sessions WHERE id = ?').get(sesId);
    }

    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
