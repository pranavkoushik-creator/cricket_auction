import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const PORT = process.env.PORT || 4000;
export const JWT_SECRET = process.env.JWT_SECRET || 'cricket-auction-super-secret-jwt-key-2026';
export const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../database.sqlite');
