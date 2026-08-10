# 📘 Comprehensive Intern & Developer Guide
## Sports Tournament & Player Auction Management Platform

Welcome to the **Sports Tournament & Player Auction Management Platform** codebase! This document provides an end-to-end, technical reference for interns and developers. Reading this guide will give you a complete understanding of the system architecture, database schema, real-time WebSocket auction engine, authentication, and frontend views.

---

## 📌 Table of Contents

1. [High-Level Architecture & Tech Stack](#1-high-level-architecture--tech-stack)
2. [Project Directory Structure](#2-project-directory-structure)
3. [Database Schema & Entity Relationships](#3-database-schema--entity-relationships)
4. [Authentication & 3-Role Authorization Model](#4-authentication--3-role-authorization-model)
5. [Real-Time WebSocket Auction Engine (`auctionEngine.ts`)](#5-real-time-websocket-auction-engine-auctionenginets)
6. [Frontend Architecture & Context State Flow](#6-frontend-architecture--context-state-flow)
7. [Frontend Feature Views Reference](#7-frontend-feature-views-reference)
8. [Local & LAN Multi-Device Network Testing](#8-local--lan-multi-device-network-testing)
9. [Intern Quickstart & Troubleshooting Cheatsheet](#9-intern-quickstart--troubleshooting-cheatsheet)

---

## 1. High-Level Architecture & Tech Stack

The application is structured as a **Monorepo** containing two decoupled packages: a Node.js/Express backend service and a Vite/React frontend web application.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           REACT FRONTEND (Vite)                         │
│  - AuthContext (JWT)                 - SocketContext (WebSockets)       │
│  - Super Admin Portal                - Dedicated Franchise Bidding View │
│  - Spectator Ticker Broadcast        - Player Registration & Approvals  │
└────────────────────┬───────────────────────────┬────────────────────────┘
                     │                           │
           HTTP REST (Port 4000)        Socket.IO WebSockets (Port 4000)
                     │                           │
┌────────────────────▼───────────────────────────▼────────────────────────┐
│                        NODE.JS BACKEND (Express)                        │
│  - REST API Controllers              - In-Memory Auction State Engine   │
│  - JWT Middleware                    - Auto-Closing Timer (30s)         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                     SQLite Database (better-sqlite3)
                                 │
                   ┌─────────────▼──────────────┐
                   │   database.sqlite (WAL)    │
                   └────────────────────────────┘
```

### Key Technology Stack:
- **Backend**: Node.js, Express, `better-sqlite3` (SQLite with Write-Ahead Logging), Socket.IO (v4), JWT (`jsonwebtoken`), `bcryptjs`, `tsx`.
- **Frontend**: React 19, TypeScript, Vite, TailwindCSS (v3), Lucide Icons, `socket.io-client`, `canvas-confetti`.
- **Database**: SQLite embedded database stored locally at `backend/src/db/database.sqlite`.

---

## 2. Project Directory Structure

```
cricket_auction/
├── package.json                    # Root package (Scripts to run backend + frontend concurrently)
├── requirements.txt                # System & npm package dependency reference
├── README.md                       # High-level overview & quickstart guide
├── CODEBASE_DOCUMENTATION.md       # (This file) Complete intern & developer technical guide
│
├── backend/                        # Express Backend Service
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts               # HTTP & Socket.IO server initialization, 0.0.0.0 LAN binding
│       ├── config.ts               # Environment configuration & port defaults
│       ├── db/
│       │   ├── database.ts         # SQLite schema initialization (13 tables)
│       │   └── seed.ts             # Initial seed data (IPL 2026, Core users, Franchises, Players)
│       ├── routes/
│       │   ├── authRoutes.ts       # Login (/api/auth/login), Session (/api/auth/me), Users
│       │   ├── tournamentRoutes.ts # Tournament CRUD & rules config
│       │   ├── playerRoutes.ts     # Player CRUD, registration, approval status state transitions
│       │   ├── franchiseRoutes.ts  # Franchise CRUD, squad roster, purse details
│       │   ├── matchRoutes.ts      # Match scheduling, live ball-by-ball scoring, points table updates
│       │   └── reportRoutes.ts     # Post-tournament summary analytics & top purchase metrics
│       ├── services/
│       │   ├── authService.ts      # User registration, bcrypt validation, JWT signing
│       │   ├── franchiseService.ts # Franchise SQL queries (joins auction_lots & players)
│       │   ├── playerService.ts    # Player queue filtering & approval state machine
│       │   ├── purseLedgerService.ts # Immutable append-only ledger transaction logger
│       │   ├── matchService.ts     # Match scoring events & NRR calculation
│       │   ├── reportService.ts    # Analytics data aggregation
│       │   └── tournamentService.ts# Tournament management logic
│       └── socket/
│           └── auctionEngine.ts    # REAL-TIME AUCTION ENGINE (WebSocket handlers, 30s timer, state)
│
└── frontend/                       # Vite + React Frontend Application
    ├── package.json
    ├── vite.config.ts              # Vite config (binds 0.0.0.0:5173 for LAN access)
    ├── tailwind.config.js          # Tailwind CSS styling configuration
    ├── src/
    │   ├── main.tsx                # React root entry point
    │   ├── App.tsx                 # Main application container, tab switcher, auth guard
    │   ├── index.css               # Global glassmorphism, rubber stamp, broadcast styling
    │   ├── types/
    │   │   └── index.ts            # TypeScript interfaces (User, Franchise, Player, AuctionState)
    │   ├── utils/
    │   │   ├── api.ts              # Dynamic REST client (auto-detects window.location.hostname)
    │   │   └── formatters.ts       # Currency formatter (₹ Cr / Lakhs), role badge color formatters
    │   ├── context/
    │   │   ├── AuthContext.tsx     # JWT authentication, user session persistence, role state
    │   │   └── SocketContext.tsx   # Realtime Socket.IO connection & auction engine event listeners
    │   ├── components/
    │   │   └── Navbar.tsx          # Role-scoped top navigation bar & user profile header
    │   └── views/
    │       ├── LoginView.tsx       # Modern Glassmorphism Login screen with 1-click Quick Demo logins
    │       ├── DashboardView.tsx   # Tournament overview, franchise standings summary
    │       ├── LiveAuctionOperatorView.tsx # Auction Operator control console (Start, Pause, Sold, Rollback)
    │       ├── LiveAuctionBiddingView.tsx  # Dedicated Franchise Bidding console (Locked per team)
    │       ├── SpectatorAuctionView.tsx    # Public IPL Broadcast tracker (AUCTION UPDATE stamp, Activity Center)
    │       ├── FranchiseManagementView.tsx # Super Admin Franchise CRUD & Immutable Ledger trail
    │       ├── PlayerApprovalQueueView.tsx # Super Admin player registration review queue
    │       ├── PlayerRegistrationView.tsx  # Player self-registration portal & personal status tracker
    │       ├── LiveScorerConsoleView.tsx   # Live match ball-by-ball scorer console & fixtures
    │       └── AnalyticsReportsView.tsx    # Tournament financial & player statistics reports
```

---

## 3. Database Schema & Entity Relationships

The platform uses SQLite (`better-sqlite3`). The schema is initialized in [`backend/src/db/database.ts`](file:///c:/Users/sakha/Desktop/cricket%20auction%20platform/backend/src/db/database.ts).

### Key Tables & Descriptions:

```
┌───────────────┐        ┌───────────────────────┐        ┌──────────────────┐
│     users     │───────<│      user_roles       │>───────│   tournaments    │
└───────────────┘        └───────────────────────┘        └──────────────────┘
        │                                                           │
        │ 1:1 (owner_id)                                            │ 1:N
        ▼                                                           ▼
┌───────────────┐        ┌───────────────────────┐        ┌──────────────────┐
│  franchises   │───────<│     purse_ledger      │        │ tournament_rules │
└───────────────┘        └───────────────────────┘        └──────────────────┘
        │ 1:N (buyer_id)                                            │
        ▼                                                           │ 1:N
┌───────────────┐        ┌───────────────────────┐                  │
│ auction_lots  │>───────│        players        │<─────────────────┘
└───────────────┘        └───────────────────────┘
        ▲
        │ 1:N
┌───────────────┐
│     bids      │
└───────────────┘
```

1. **`users`**: Stores system users (`id`, `name`, `email`, `password_hash`, `avatar_url`, `status`).
2. **`user_roles`**: Maps users to tournament roles (`user_id`, `tournament_id`, `role`).
3. **`tournaments`**: Tournament records (`id`, `name`, `sport`, `format`, `dates`, `status`).
4. **`tournament_rules`**: Rules per tournament (`purse_budget`, `min_squad`, `max_squad`, `foreign_player_limit`, `base_price_tiers`, `increment_ladder`).
5. **`franchises`**: Franchise teams (`id`, `tournament_id`, `name`, `short_name`, `owner_id`, `initial_purse`, `remaining_purse`, `primary_color`, `secondary_color`).
6. **`players`**: Player registry (`id`, `tournament_id`, `name`, `category`, `role`, `is_foreign`, `country`, `base_price`, `approval_status`, `stats_json`).
7. **`auction_sessions`**: Auction state session tracking (`id`, `tournament_id`, `status`, `current_lot_id`, `timer_seconds`).
8. **`auction_lots`**: Links players to auction queue/sales (`id`, `session_id`, `player_id`, `sequence_number`, `status`, `current_highest_bid`, `current_bidder_id`, `buyer_id`, `sold_price`).
9. **`bids`**: Historical log of every bid placed during live auction (`id`, `lot_id`, `franchise_id`, `amount`, `timestamp`).
10. **`purse_ledger`**: **Immutable append-only audit trail** for franchise purse transactions (`id`, `franchise_id`, `lot_id`, `transaction_type`, `amount`, `balance_after`, `note`, `timestamp`).
11. **`matches`**, **`match_events`**, **`points_table`**: Fixtures, live scoring logs, and calculated Net Run Rate (NRR) standings.

---

## 4. Authentication & 3-Role Authorization Model

The application enforces a **3-Role JWT Access Model**:

| Core Role | Pre-configured Credentials | Scope & Capabilities |
|---|---|---|
| 👑 **Super Admin** | `admin@platform.com` / `password123` | **Full Master Access**: Dashboard, Operator Live Console, Franchise CRUD, Player Approval Queue, Live Scorer, Analytics Reports. |
| 🛡️ **Franchise Owner** | `mi@franchise.com` / `password123`<br>`csk@franchise.com` / `password123`<br>`rcb@franchise.com` / `password123`<br>`dc@franchise.com` / `password123` | **Dedicated Team Console**: Bidding is strictly locked to their assigned team (`MI`, `CSK`, `RCB`, `DC`). Access to Squad Roster, Purse Ledger, Spectator Ticker, Reports. |
| 👤 **Player** | `player@cricket.com` / `password123` | **Player Portal**: Self-registration form, personal approval/auction status tracker, public live spectator ticker. |

### Authentication Flow:
1. Client submits credentials to `POST /api/auth/login`.
2. [`backend/src/services/authService.ts`](file:///c:/Users/sakha/Desktop/cricket%20auction%20platform/backend/src/services/authService.ts) verifies `bcrypt` password hash and issues a JWT token containing:
   `{ userId, email, role, franchise_id, franchise_name, franchise_short }`.
3. Client stores token in `localStorage`.
4. Subsequent REST requests pass `Authorization: Bearer <token>`.
5. Upon page reload, [`frontend/src/context/AuthContext.tsx`](file:///c:/Users/sakha/Desktop/cricket%20auction%20platform/frontend/src/context/AuthContext.tsx) validates token via `GET /api/auth/me`.

---

## 5. Real-Time WebSocket Auction Engine (`auctionEngine.ts`)

The auction engine ([`backend/src/socket/auctionEngine.ts`](file:///c:/Users/sakha/Desktop/cricket%20auction%20platform/backend/src/socket/auctionEngine.ts)) manages live bidding state in-memory via WebSocket events.

```
                  ┌───────────────────────────────┐
                  │    operator:start_lot(lotId)  │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │  status = 'live', timer = 30s │
                  └──────────────┬────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
      [place_bid event]                     [30s Timer Expires]
              │                                     │
              ▼                                     ▼
┌───────────────────────────┐             ┌───────────────────┐
│ Validates Purse & Rules   │             │   autoCloseLot()  │
│ Resets timer to 30s       │             └─────────┬─────────┘
│ Broadcasts updated state  │                       │
└───────────────────────────┘         ┌─────────────┴─────────────┐
                                      ▼                           ▼
                              Bids Exist? Yes             Bids Exist? No
                                      │                           │
                                      ▼                           ▼
                              Status = 'sold'             Status = 'unsold'
                              Deducts Purse               Returns to queue
```

### Key Socket Events (`Socket.IO`):

| Event Name | Direction | Payload / Description |
|---|---|---|
| `join:auction` | Client ➔ Server | `{ tournamentId }` — Client joins tournament room. |
| `auction:state` | Server ➔ Client | `ActiveAuctionState` — Broadcasts current lot, highest bid, bidder name, and timer. |
| `auction:event` | Server ➔ Client | `{ type, message, timestamp }` — Broadcasts live activity log. |
| `place_bid` | Client ➔ Server | `{ franchiseId, amount }` — Validates purse, minimum next increment, squad limit, and updates state. |
| `operator:start_lot` | Operator ➔ Server | `{ lotId }` — Initializes new player lot on the block and starts 30s countdown. |
| `operator:mark_sold` | Operator ➔ Server | Finalizes current lot as sold, updates DB `auction_lots` and inserts `purse_ledger` entry. |
| `operator:mark_unsold` | Operator ➔ Server | Marks player unsold and updates DB `auction_lots`. |
| `operator:toggle_pause` | Operator ➔ Server | Pauses/resumes live countdown timer. |
| `operator:rollback_sale` | Operator ➔ Server | `{ lotId }` — Reverts a sold/unsold lot back to queued status and refunds purse. |

---

## 6. Frontend Architecture & Context State Flow

The React frontend utilizes two global contexts:

1. **`AuthContext.tsx`**:
   - Manages `token`, `user`, `isAuthenticated`, `currentRole`, and `selectedFranchiseId`.
   - Exposes `login(email, password)` and `logout()`.
   - Automatically forces `selectedFranchiseId` to `user.franchise_id` if the user is a `Franchise Owner`.

2. **`SocketContext.tsx`**:
   - Maintains a single, persistent Socket.IO connection.
   - **Dynamic Host Resolution**: Detects `window.location.hostname` so that clients connecting over LAN (`http://192.168.x.x:5173`) automatically connect to `http://192.168.x.x:4000`.
   - Listens to `auction:state` and `auction:event`, updating global React state across all views.

---

## 7. Frontend Feature Views Reference

| View File | Allowed Roles | Core Features |
|---|---|---|
| [`LoginView.tsx`](file:///c:/Users/sakha/Desktop/cricket%20auction%20platform/frontend/src/views/LoginView.tsx) | Unauthenticated | Glassmorphism login form + 1-Click Quick Demo Login cards for all 3 core roles. |
| [`DashboardView.tsx`](file:///c:/Users/sakha/Desktop/cricket%20auction%20platform/frontend/src/views/DashboardView.tsx) | Super Admin | Tournament overview, quick stats metrics, team breakdown summaries. |
| [`LiveAuctionOperatorView.tsx`](file:///c:/Users/sakha/Desktop/cricket%20auction%20platform/frontend/src/views/LiveAuctionOperatorView.tsx) | Super Admin | Auctioneer control desk. Select player lot, Start Bidding, Pause Timer, Mark Sold/Unsold, Rollback Lot. |
| [`LiveAuctionBiddingView.tsx`](file:///c:/Users/sakha/Desktop/cricket%20auction%20platform/frontend/src/views/LiveAuctionBiddingView.tsx) | Super Admin, Franchise Owner | Live bidding desk with purse budget tracker. Locked strictly to assigned franchise for Franchise Owners. |
| [`SpectatorAuctionView.tsx`](file:///c:/Users/sakha/Desktop/cricket%20auction%20platform/frontend/src/views/SpectatorAuctionView.tsx) | All Roles | Public IPL Broadcast display: Gold `AUCTION UPDATE` card, rotated `SOLD`/`UNSOLD` rubber stamps, Activity Center stream, sales confetti. |
| [`FranchiseManagementView.tsx`](file:///c:/Users/sakha/Desktop/cricket%20auction%20platform/frontend/src/views/FranchiseManagementView.tsx) | Super Admin, Franchise Owner | Team management console, Create/Edit/Delete Franchise modals, Squad Roster table, Immutable Purse Ledger audit timeline. |
| [`PlayerApprovalQueueView.tsx`](file:///c:/Users/sakha/Desktop/cricket%20auction%20platform/frontend/src/views/PlayerApprovalQueueView.tsx) | Super Admin | Admin review queue for player registrations (Approve, Reject, Request Changes). |
| [`PlayerRegistrationView.tsx`](file:///c:/Users/sakha/Desktop/cricket%20auction%20platform/frontend/src/views/PlayerRegistrationView.tsx) | Player | Player self-registration form & real-time personal status tracker. |
| [`LiveScorerConsoleView.tsx`](file:///c:/Users/sakha/Desktop/cricket%20auction%20platform/frontend/src/views/LiveScorerConsoleView.tsx) | Super Admin | Ball-by-ball match scoring console, match events log, automatic Net Run Rate (NRR) & Points Table calculation. |
| [`AnalyticsReportsView.tsx`](file:///c:/Users/sakha/Desktop/cricket%20auction%20platform/frontend/src/views/AnalyticsReportsView.tsx) | Super Admin, Franchise Owner | Financial reports, top purchases breakdown, franchise budget utilization analytics. |

---

## 8. Local & LAN Multi-Device Network Testing

The application is fully configured for multi-device testing over a local Wi-Fi or LAN.

### How LAN Support Works:
1. **Express & Socket.IO**: Bound to `0.0.0.0:4000` in [`backend/src/server.ts`](file:///c:/Users/sakha/Desktop/cricket%20auction%20platform/backend/src/server.ts).
2. **Vite Dev Server**: Configured with `server: { host: '0.0.0.0', port: 5173 }` in [`frontend/vite.config.ts`](file:///c:/Users/sakha/Desktop/cricket%20auction%20platform/frontend/vite.config.ts).
3. **Dynamic Client Resolution**: `window.location.hostname` is evaluated in [`utils/api.ts`](file:///c:/Users/sakha/Desktop/cricket%20auction%20platform/frontend/src/utils/api.ts) and `SocketContext.tsx`, directing mobile phones or second laptops to the host machine's IP.

### Multi-Device Testing Instructions:
- **Host PC**: Run `npm run dev`. Note your LAN IP printed in terminal (e.g. `http://192.168.6.131:5173`).
- **Device 1 (Host PC)**: Open `http://localhost:5173` ➔ Log in as **Super Admin** ➔ Open **Operator Console**.
- **Device 2 (Second Laptop/Phone)**: Open `http://192.168.6.131:5173` ➔ Log in as **MI Owner** (`mi@franchise.com`) ➔ Open **Live Franchise Bidding**.
- **Device 3 (Third Laptop/Phone)**: Open `http://192.168.6.131:5173` ➔ Log in as **CSK Owner** (`csk@franchise.com`) ➔ Place counter-bids.
- **Device 4 (TV / Display)**: Open `http://192.168.6.131:5173` ➔ View **Spectator Live Ticker**.

---

## 9. Intern Quickstart & Troubleshooting Cheatsheet

### Common Terminal Commands:

```bash
# 1. Install all dependencies across root, backend, and frontend:
npm run install:all

# 2. Launch both Backend (Port 4000) & Frontend (Port 5173) concurrently:
npm run dev

# 3. Check Frontend TypeScript compilation:
cd frontend && npx tsc --noEmit

# 4. Re-seed SQLite Database from scratch (if database gets messy):
# Simply delete backend/src/db/database.sqlite and restart backend:
del backend\src\db\database.sqlite
npm run dev:backend
```

### Intern Tips:
- **Where is the database file?**: It is created automatically at `backend/src/db/database.sqlite`.
- **How to add a new REST API endpoint?**:
  1. Add function in `backend/src/services/<serviceName>.ts`.
  2. Register route in `backend/src/routes/<routeName>.ts`.
  3. Call endpoint using `apiRequest('/path')` in frontend.
- **How to add a new Socket event?**:
  1. Add event listener in `setupAuctionSocket(io)` inside `backend/src/socket/auctionEngine.ts`.
  2. Trigger event or listen in `frontend/src/context/SocketContext.tsx`.

---
*Documentation compiled for Sakha Sports League · Prepared for Developer & Intern Onboarding*
