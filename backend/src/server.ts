import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
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

// Function to find local network IP addresses
function getLocalNetworkIps(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

const numPort = Number(PORT) || 4000;
server.listen(numPort, '0.0.0.0', () => {
  const ips = getLocalNetworkIps();
  console.log(`====================================================`);
  console.log(` 🏏 SPORTS TOURNAMENT & AUCTION BACKEND SERVER`);
  console.log(` 🚀 Local:   http://localhost:${PORT}`);
  ips.forEach(ip => {
    console.log(` 🌐 Network: http://${ip}:${PORT}`);
    console.log(` 📱 Client App (LAN): http://${ip}:5173`);
  });
  console.log(` ⚡ Realtime WebSocket Engine: ACTIVE (Bound to 0.0.0.0)`);
  console.log(`====================================================`);
});
