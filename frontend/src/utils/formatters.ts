export function formatCurrency(amount: number): string {
  if (amount === undefined || amount === null) return '₹0';
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatRoleColor(role: string): string {
  switch (role) {
    case 'Super Admin':
      return 'bg-purple-900/40 text-purple-300 border-purple-500/40';
    case 'Tournament Admin':
      return 'bg-blue-900/40 text-blue-300 border-blue-500/40';
    case 'Auction Operator':
      return 'bg-yellow-900/40 text-yellow-300 border-yellow-500/40';
    case 'Franchise Owner':
      return 'bg-emerald-900/40 text-emerald-300 border-emerald-500/40';
    case 'Player':
      return 'bg-cyan-900/40 text-cyan-300 border-cyan-500/40';
    case 'Scorer':
      return 'bg-pink-900/40 text-pink-300 border-pink-500/40';
    default:
      return 'bg-gray-800 text-gray-300 border-gray-700';
  }
}
