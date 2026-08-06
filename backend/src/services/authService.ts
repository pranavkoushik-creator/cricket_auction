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

  // Assign default Spectator role for active tournaments
  const tournaments = db.prepare('SELECT id FROM tournaments').all() as { id: string }[];
  for (const t of tournaments) {
    db.prepare(`
      INSERT OR IGNORE INTO user_roles (id, user_id, tournament_id, role)
      VALUES (?, ?, ?, 'Spectator')
    `).run(uuidv4(), id, t.id);
  }

  const token = jwt.sign({ userId: id, email }, JWT_SECRET, { expiresIn: '7d' });
  return { user: { id, name, email, phone, avatar_url }, token };
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

  const roles = db.prepare('SELECT tournament_id, role FROM user_roles WHERE user_id = ?').all(user.id) as any[];

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar_url: user.avatar_url,
      roles
    },
    token
  };
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
