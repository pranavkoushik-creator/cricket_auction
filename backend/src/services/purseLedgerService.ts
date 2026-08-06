import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

export function getFranchisePurse(franchiseId: string) {
  const franchise = db.prepare('SELECT id, name, initial_purse, remaining_purse FROM franchises WHERE id = ?').get(franchiseId) as any;
  if (!franchise) {
    throw new Error('Franchise not found');
  }

  // Calculate sum of ledger transactions
  const ledgerSum = db.prepare(`
    SELECT SUM(amount) as net_total FROM purse_ledger WHERE franchise_id = ?
  `).get(franchiseId) as { net_total: number | null };

  const currentPurse = ledgerSum.net_total !== null ? ledgerSum.net_total : franchise.initial_purse;

  // Sync remaining_purse in franchises table
  db.prepare('UPDATE franchises SET remaining_purse = ? WHERE id = ?').run(currentPurse, franchiseId);

  const ledger = db.prepare(`
    SELECT pl.*, al.player_id, p.name as player_name
    FROM purse_ledger pl
    LEFT JOIN auction_lots al ON pl.lot_id = al.id
    LEFT JOIN players p ON al.player_id = p.id
    WHERE pl.franchise_id = ?
    ORDER BY pl.timestamp DESC
  `).all(franchiseId);

  return {
    franchiseId,
    initialPurse: franchise.initial_purse,
    remainingPurse: currentPurse,
    ledger
  };
}

export function recordPurseTransaction(
  franchiseId: string,
  amount: number, // negative for deduction, positive for refund/credit
  transactionType: 'initial_credit' | 'bid_deduction' | 'sale_refund' | 'adjustment',
  lotId?: string,
  note?: string
) {
  const current = getFranchisePurse(franchiseId);
  const newBalance = current.remainingPurse + amount;

  if (newBalance < 0 && amount < 0) {
    throw new Error(`Insufficient purse balance. Available: ₹${(current.remainingPurse / 10000000).toFixed(2)} Cr, Required: ₹${(Math.abs(amount) / 10000000).toFixed(2)} Cr.`);
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO purse_ledger (id, franchise_id, lot_id, transaction_type, amount, balance_after, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, franchiseId, lotId || null, transactionType, amount, newBalance, note || null);

  // Update cached remaining_purse
  db.prepare('UPDATE franchises SET remaining_purse = ? WHERE id = ?').run(newBalance, franchiseId);

  return { id, franchiseId, amount, newBalance, transactionType };
}
