# 🏏 Sports Tournament & Player Auction Management Platform

An end-to-end, multi-tenant platform for sports tournaments, IPL-style live player auctions with real-time bidding and immutable purse ledgers, match scheduling, ball-by-ball live scoring, points table calculations (NRR/points), and post-tournament reporting.

---

## 📋 System Requirements

- **Node.js**: `v18.0.0` or higher (Recommended: `v20.x` or `v22.x` LTS)
- **NPM**: `v9.0.0` or higher
- **OS**: Windows, macOS, or Linux

---

## ⚙️ Installation Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/pranavkoushik-creator/cricket_auction.git
cd cricket_auction
```

### 2. Install Dependencies
You can install dependencies for both backend and frontend using the root command:
```bash
npm run install:all
```
*(Or manually navigate into `backend` and `frontend` folders and run `npm install` in each).*

---

## 🚀 Running the Platform Locally

### Start Backend Server (Port 4000)
```bash
npm run dev:backend
```
The backend initializes SQLite, seeds initial IPL 2026 data, and starts the Socket.IO real-time auction engine.

### Start Frontend Application (Port 5173)
In a new terminal window:
```bash
npm run dev:frontend
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📌 Main Modules & Features

1. **Live Auction Engine (IPL-Style)**: Real-time Socket.IO bid validation, 15s lot timer, duplicate bid prevention, squad limits, and foreign player enforcement.
2. **Spectator Live Tracker**: IPL broadcast visual theme with `AUCTION UPDATE` cards, rotated `SOLD`/`UNSOLD` rubber stamps, and real-time Activity Center stream.
3. **Super Admin Franchise Console**: Full CRUD management of franchise teams, purse budgets, owner assignments, and immutable purse ledger tracking.
4. **Player Registration & Approval Queue**: Self-registration portal and admin review queue with status state machine (Approved, Rejected, Suspended).
5. **Live Scorer Console**: Real-time ball-by-ball cricket scoring console with automatic Points Table & Net Run Rate (NRR) updates.

---

## 📄 Dependency Reference File
Refer to [requirements.txt](file:///c:/Users/sakha/Desktop/cricket%20auction%20platform/requirements.txt) for a complete listing of all system and package dependencies.
