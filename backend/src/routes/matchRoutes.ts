import { Router, Request, Response } from 'express';
import { getMatches, getMatchById, generateFixtures, addMatchEvent, completeMatch, getStandings } from '../services/matchService';
import {
  getLiveMatchState,
  getMatchSquads,
  getBroadcastableMatches,
  startInnings,
  recordBall,
  setNewBatter,
  setBowler,
  swapStrike,
  replaceBatter,
  completeInnings,
  completeMatchNow,
  undoLastBall
} from '../services/liveMatchService';
import { broadcastMatch } from '../socket/matchEngine';
import { authenticate } from '../middleware/authMiddleware';
import { authorize } from '../middleware/roleMiddleware';

const router = Router();

// ---------------------------------------------------------------------------
// PUBLIC BROADCAST ENDPOINTS
// Declared before router.use(authenticate) so unauthenticated spectators can
// follow a live match, exactly as they can watch the auction ticker.
// ---------------------------------------------------------------------------

router.get('/public/live', (req: Request, res: Response) => {
  try {
    const tournamentId = (req.query.tournamentId as string) || 'tour-ipl-2026';
    res.json(getBroadcastableMatches(tournamentId));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/public/live/:id', (req: Request, res: Response) => {
  try {
    res.json(getLiveMatchState(req.params.id as string));
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.use(authenticate);

/**
 * Every scorer mutation runs the service, broadcasts the new authoritative
 * state to the match room, and returns that same state to the caller.
 */
function scorerAction(
  req: Request,
  res: Response,
  action: () => ReturnType<typeof getLiveMatchState>,
  eventType: string
) {
  try {
    const state = action();
    broadcastMatch(req.params.id as string, state, eventType);
    res.json(state);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

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

// ---------------------------------------------------------------------------
// LIVE MATCH BROADCAST
// ---------------------------------------------------------------------------

router.get('/:id/live', authorize('Super Admin', 'Franchise Owner', 'Player'), (req: Request, res: Response) => {
  try {
    res.json(getLiveMatchState(req.params.id as string));
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.get('/:id/squads', authorize('Super Admin', 'Franchise Owner', 'Player'), (req: Request, res: Response) => {
  try {
    res.json(getMatchSquads(req.params.id as string));
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/:id/innings/start', authorize('Super Admin'), (req: Request, res: Response) => {
  const { battingTeamId, strikerId, nonStrikerId, bowlerId, oversLimit } = req.body;
  scorerAction(req, res, () => startInnings(req.params.id as string, {
    battingTeamId, strikerId, nonStrikerId, bowlerId, oversLimit
  }), 'innings_start');
});

router.post('/:id/ball', authorize('Super Admin'), (req: Request, res: Response) => {
  const { runs, extraType, isWicket, dismissalType, dismissedPlayerId, batsmenCrossed } = req.body;
  scorerAction(req, res, () => recordBall(req.params.id as string, {
    runs, extraType, isWicket, dismissalType, dismissedPlayerId, batsmenCrossed
  }), 'ball');
});

router.post('/:id/batter', authorize('Super Admin'), (req: Request, res: Response) => {
  scorerAction(req, res, () => setNewBatter(req.params.id as string, req.body.playerId), 'new_batter');
});

router.post('/:id/batter/replace', authorize('Super Admin'), (req: Request, res: Response) => {
  const { outgoingId, incomingId } = req.body;
  scorerAction(req, res, () => replaceBatter(req.params.id as string, outgoingId, incomingId), 'batter_replaced');
});

router.post('/:id/bowler', authorize('Super Admin'), (req: Request, res: Response) => {
  scorerAction(req, res, () => setBowler(req.params.id as string, req.body.playerId), 'bowler_change');
});

router.post('/:id/strike/swap', authorize('Super Admin'), (req: Request, res: Response) => {
  scorerAction(req, res, () => swapStrike(req.params.id as string), 'strike_swap');
});

router.post('/:id/undo', authorize('Super Admin'), (req: Request, res: Response) => {
  scorerAction(req, res, () => undoLastBall(req.params.id as string), 'undo');
});

router.post('/:id/innings/complete', authorize('Super Admin'), (req: Request, res: Response) => {
  scorerAction(req, res, () => completeInnings(req.params.id as string), 'innings_complete');
});

router.post('/:id/match/complete', authorize('Super Admin'), (req: Request, res: Response) => {
  scorerAction(req, res, () => completeMatchNow(req.params.id as string), 'match_complete');
});

export default router;
