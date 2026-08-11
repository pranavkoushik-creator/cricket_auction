import { Router, Request, Response } from 'express';
import { getMatches, getMatchById, generateFixtures, addMatchEvent, completeMatch, getStandings } from '../services/matchService';
import { authenticate } from '../middleware/authMiddleware';
import { authorize } from '../middleware/roleMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', authorize('Super Admin', 'Franchise Owner', 'Player'), (req: Request, res: Response) => {
  try {
    const tournamentId = (req.query.tournamentId as string) || 'tour-ipl-2026';
    const matches = getMatches(tournamentId);
    res.json(matches);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/standings', authorize('Super Admin', 'Franchise Owner', 'Player'), (req: Request, res: Response) => {
  try {
    const tournamentId = (req.query.tournamentId as string) || 'tour-ipl-2026';
    const standings = getStandings(tournamentId);
    res.json(standings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authorize('Super Admin', 'Franchise Owner', 'Player'), (req: Request, res: Response) => {
  try {
    const match = getMatchById(req.params.id as string);
    res.json(match);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/generate', authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const tournamentId = req.body.tournamentId || 'tour-ipl-2026';
    const matches = generateFixtures(tournamentId);
    res.json(matches);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/event', authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const { innings, eventType, payload } = req.body;
    const match = addMatchEvent(req.params.id as string, innings || 1, eventType || 'ball', payload || {});
    res.json(match);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/complete', authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const { winnerTeamId, resultSummary, homeScore, awayScore } = req.body;
    const match = completeMatch(req.params.id as string, winnerTeamId, resultSummary, homeScore, awayScore);
    res.json(match);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
