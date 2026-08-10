import { Router, Request, Response } from 'express';
import { getMatches, getMatchById, generateFixtures, addMatchEvent, completeMatch, getStandings } from '../services/matchService';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const tournamentId = (req.query.tournamentId as string) || 'tour-ipl-2026';
    const matches = getMatches(tournamentId);
    res.json(matches);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/standings', (req: Request, res: Response) => {
  try {
    const tournamentId = (req.query.tournamentId as string) || 'tour-ipl-2026';
    const standings = getStandings(tournamentId);
    res.json(standings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const match = getMatchById(req.params.id as string);
    res.json(match);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/generate', (req: Request, res: Response) => {
  try {
    const tournamentId = req.body.tournamentId || 'tour-ipl-2026';
    const matches = generateFixtures(tournamentId);
    res.json(matches);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/event', (req: Request, res: Response) => {
  try {
    const { innings, eventType, payload } = req.body;
    const match = addMatchEvent(req.params.id as string, innings || 1, eventType || 'ball', payload || {});
    res.json(match);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/complete', (req: Request, res: Response) => {
  try {
    const { winnerTeamId, resultSummary, homeScore, awayScore } = req.body;
    const match = completeMatch(req.params.id as string, winnerTeamId, resultSummary, homeScore, awayScore);
    res.json(match);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
