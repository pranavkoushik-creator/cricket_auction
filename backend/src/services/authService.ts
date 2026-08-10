import { db } from '../db/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';
import { v4 as uuidv4 } from 'uuid';

export function registerUser(name: string, email: string, password: string, phone?: string) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    throw new Error('User with this email already exists.');
  }

  const id = `usr-${uuidv4().substring(0, 8)}`;
  const password_hash = bcrypt.hashSync(password, 10);
  const avatar_url = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`;

  db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, email, phone || null, password_hash, avatar_url);

  // Default role for self-registered user is 'Player'
  const tournaments = db.prepare('SELECT id FROM tournaments').all() as { id: string }[];
  for (const t of tournaments) {
    db.prepare(`
      INSERT OR IGNORE INTO user_roles (id, user_id, tournament_id, role)
      VALUES (?, ?, ?, 'Player')
    `).run(uuidv4(), id, t.id);
  }

  return loginUser(email, password);
}

export function createFranchiseOwner(name: string, email: string, password?: string, phone?: string) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    throw new Error('User with this email already exists.');
  }

  const id = `usr-owner-${uuidv4().substring(0, 8)}`;
  const password_hash = bcrypt.hashSync(password || 'password123', 10);
  const avatar_url = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`;

  db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, email, phone || null, password_hash, avatar_url);

  // Assign Franchise Owner role for active tournaments
  const tournaments = db.prepare('SELECT id FROM tournaments').all() as { id: string }[];
  for (const t of tournaments) {
    db.prepare(`
      INSERT OR IGNORE INTO user_roles (id, user_id, tournament_id, role)
      VALUES (?, ?, ?, 'Franchise Owner')
    `).run(uuidv4(), id, t.id);
  }

  return { id, name, email, phone, role: 'Franchise Owner' };
}

export function loginUser(email: string, password: string) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!user) {
    throw new Error('Invalid email or password.');
  }

  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) {
    throw new Error('Invalid email or password.');
  }

  // Fetch user role for tournament
  const roleRecord = db.prepare('SELECT role FROM user_roles WHERE user_id = ? ORDER BY id ASC LIMIT 1').get(user.id) as any;
  const role = roleRecord?.role || 'Player';

  // If role is Franchise Owner, fetch associated franchise
  let franchise: any = null;
  if (role === 'Franchise Owner') {
    franchise = db.prepare('SELECT id, name, short_name FROM franchises WHERE owner_id = ? LIMIT 1').get(user.id) as any;
  }

  const tokenPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role,
    franchise_id: franchise?.id || null,
    franchise_name: franchise?.name || null,
    franchise_short: franchise?.short_name || null
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar_url: user.avatar_url,
      role,
      franchise_id: franchise?.id || null,
      franchise_name: franchise?.name || null,
      franchise_short: franchise?.short_name || null
    },
    token
  };
}

export function verifyTokenAndGetUser(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = db.prepare('SELECT id, name, email, phone, avatar_url FROM users WHERE id = ?').get(decoded.userId) as any;
    if (!user) throw new Error('User not found');

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar_url: user.avatar_url,
      role: decoded.role,
      franchise_id: decoded.franchise_id,
      franchise_name: decoded.franchise_name,
      franchise_short: decoded.franchise_short
    };
  } catch (err) {
    throw new Error('Invalid or expired authentication token');
  }
}

export function getAllUsers() {
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.status, u.avatar_url, u.created_at
    FROM users u
  `).all() as any[];

  for (const user of users) {
    user.roles = db.prepare('SELECT tournament_id, role FROM user_roles WHERE user_id = ?').all(user.id);
  }

  return users;
}

export function setUserTournamentRole(userId: string, tournamentId: string, role: string) {
  db.prepare('DELETE FROM user_roles WHERE user_id = ? AND tournament_id = ?').run(userId, tournamentId);
  db.prepare(`
    INSERT INTO user_roles (id, user_id, tournament_id, role)
    VALUES (?, ?, ?, ?)
  `).run(uuidv4(), userId, tournamentId, role);
  return { success: true, userId, tournamentId, role };
}
