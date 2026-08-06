import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PORT } from './config';
import { seedData } from './db/seed';

import authRoutes from './routes/authRoutes';
import tournamentRoutes from './routes/tournamentRoutes';
import playerRoutes from './routes/playerRoutes';
import franchiseRoutes from './routes/franchiseRoutes';
import matchRoutes from './routes/matchRoutes';
import reportRoutes from './routes/reportRoutes';
import { setupAuctionSocket } from './socket/auctionEngine';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});

app.use(cors());
app.use(express.json());

// Initialize database and seed initial IPL 2026 data
seedData();

// On startup: reset any stale 'live' auction lots and sessions back to queued/scheduled
// (in-memory auction state is lost on server restart, so we must clean up)
import { db } from './db/database';
(function cleanupStaleLots() {
  const staleLots = db.prepare("UPDATE auction_lots SET status = 'queued', current_highest_bid = 0, current_bidder_id = null WHERE status = 'live'").run();
  db.prepare("UPDATE auction_sessions SET status = 'scheduled', current_lot_id = (SELECT id FROM auction_lots WHERE tournament_id = auction_sessions.tournament_id AND status = 'queued' ORDER BY sequence_number ASC LIMIT 1) WHERE status = 'live'").run();
  if (staleLots.changes > 0) {
    console.log(`[Server] Reset ${staleLots.changes} stale live lot(s) to queued status on startup.`);
  }
})();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/franchises', franchiseRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), system: 'Sports Auction & Tournament Platform Engine' });
});

// Realtime Auction WebSocket
setupAuctionSocket(io);

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` 🏏 SPORTS TOURNAMENT & AUCTION BACKEND SERVER`);
  console.log(` 🚀 Running on: http://localhost:${PORT}`);
  console.log(` ⚡ WebSocket Realtime Engine: ACTIVE`);
  console.log(`====================================================`);
});
