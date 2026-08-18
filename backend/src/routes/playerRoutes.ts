import { Router, Request, Response } from 'express';
import { getPlayers, registerPlayer, updatePlayerApprovalStatus, createSinglePlayer, bulkImportPlayers, updatePlayer } from '../services/playerService';
import { authenticate } from '../middleware/authMiddleware';
import { authorize } from '../middleware/roleMiddleware';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
    const { tournament_id, name, group_name, role, base_price } = req.body;
    if (!tournament_id || !name || !group_name || base_price === undefined) {
      return res.status(400).json({ error: 'Tournament ID, Name, Group Name, and Base Price are required.' });
    }
    const player = createSinglePlayer({ ...req.body, role: role || 'Player' });
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

router.post('/upload-image', authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const { image, name, originalName } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image data provided.' });
    }

    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid base64 image format.' });
    }

    const type = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const targetDir = path.join(__dirname, '../../images');

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Check MD5 hash of image to prevent saving duplicate file copies
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    let existingFilename: string | null = null;

    const files = fs.readdirSync(targetDir);
    for (const file of files) {
      const filePath = path.join(targetDir, file);
      if (fs.statSync(filePath).isFile()) {
        try {
          const fileContent = fs.readFileSync(filePath);
          const fileHash = crypto.createHash('md5').update(fileContent).digest('hex');
          if (fileHash === hash) {
            existingFilename = file;
            break;
          }
        } catch (e) {
          // ignore read errors
        }
      }
    }

    if (existingFilename) {
      return res.json({ url: `/images/${existingFilename}` });
    }

    let ext = 'jpg';
    if (type.includes('png')) ext = 'png';
    else if (type.includes('webp')) ext = 'webp';

    let cleanBaseName = 'player_photo';
    if (originalName) {
      const lastDot = originalName.lastIndexOf('.');
      cleanBaseName = lastDot !== -1 ? originalName.substring(0, lastDot) : originalName;
    } else if (name) {
      cleanBaseName = name;
    }

    const safeName = cleanBaseName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .substring(0, 30);

    const filename = `${safeName}_${Date.now()}.${ext}`;
    const targetPath = path.join(targetDir, filename);
    fs.writeFileSync(targetPath, buffer);

    res.json({ url: `/images/${filename}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authorize('Super Admin'), (req: Request, res: Response) => {
  try {
    const player = updatePlayer(req.params.id as string, req.body);
    res.json(player);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
