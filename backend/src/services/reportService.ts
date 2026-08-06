import { db } from '../db/database';

export function getAuctionReport(tournamentId: string) {
  const franchises = db.prepare(`
    SELECT f.id, f.name, f.short_name, f.initial_purse, f.remaining_purse, f.primary_color,
           (f.initial_purse - f.remaining_purse) as total_spent,
           COUNT(al.id) as squad_size
    FROM franchises f
    LEFT JOIN auction_lots al ON al.buyer_id = f.id AND al.status = 'sold'
    WHERE f.tournament_id = ?
    GROUP BY f.id
  `).all(tournamentId) as any[];

  const soldLots = db.prepare(`
    SELECT al.id, al.sold_price, p.name as player_name, p.category, p.role, p.is_foreign, p.country, f.name as buyer_name, f.short_name as buyer_short
    FROM auction_lots al
    JOIN players p ON al.player_id = p.id
    JOIN franchises f ON al.buyer_id = f.id
    WHERE al.tournament_id = ? AND al.status = 'sold'
    ORDER BY al.sold_price DESC
  `).all(tournamentId) as any[];

  const unsoldLots = db.prepare(`
    SELECT al.id, p.name as player_name, p.category, p.role, p.base_price
    FROM auction_lots al
    JOIN players p ON al.player_id = p.id
    WHERE al.tournament_id = ? AND al.status = 'unsold'
  `).all(tournamentId) as any[];

  const totalSpent = soldLots.reduce((sum, lot) => sum + (lot.sold_price || 0), 0);
  const highestBid = soldLots.length > 0 ? soldLots[0] : null;
  const avgBid = soldLots.length > 0 ? Math.round(totalSpent / soldLots.length) : 0;

  return {
    summary: {
      total_franchises: franchises.length,
      total_players_sold: soldLots.length,
      total_players_unsold: unsoldLots.length,
      total_spend_inr: totalSpent,
      average_bid_inr: avgBid,
      highest_bid: highestBid
    },
    franchise_breakdown: franchises,
    top_purchases: soldLots.slice(0, 10),
    sold_lots: soldLots,
    unsold_lots: unsoldLots
  };
}
