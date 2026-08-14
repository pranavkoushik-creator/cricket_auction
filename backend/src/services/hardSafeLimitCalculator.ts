interface GroupRule {
  group_name: string;
  base_price: number;
  min_players: number;
  max_players?: number;
}

interface CalculatorParams {
  wallet: number;
  squad: Array<{ group_name: string; sold_price?: number }>;
  currentPlayerGroup: string;
  customRulesJson: string | any;
}

export function parseGroupRules(customRulesJson: any): GroupRule[] {
  try {
    const parsed = typeof customRulesJson === 'string' ? JSON.parse(customRulesJson) : customRulesJson;
    if (parsed && Array.isArray(parsed.group_rules)) {
      return parsed.group_rules;
    }
  } catch (e) {
    console.error('[HardSafeLimitCalculator] Failed to parse group rules:', e);
  }
  // Default rules according to business specification
  return [
    { group_name: "GROUP A", base_price: 100000, min_players: 2, max_players: 2 },
    { group_name: "GROUP B", base_price: 50000, min_players: 2, max_players: 2 },
    { group_name: "GROUP C", base_price: 25000, min_players: 3, max_players: 3 }
  ];
}

export function calculateMinimumFutureReserve(
  franchiseState: { squad: Array<{ group_name: string; sold_price?: number }>; remainingPurse: number },
  currentPlayerGroup: string,
  tournamentRules: { custom_rules_json?: any }
) {
  const groupRules = parseGroupRules(tournamentRules?.custom_rules_json);
  const squad = franchiseState.squad || [];

  // Group counts before hypothetical purchase
  const currentGroupCounts: Record<string, number> = {};
  groupRules.forEach(rule => {
    currentGroupCounts[rule.group_name.toUpperCase()] = 0;
  });

  squad.forEach((p: any) => {
    const g = (p.group_name || '').toUpperCase();
    if (g in currentGroupCounts) {
      currentGroupCounts[g]++;
    }
  });

  // Simulated group counts after hypothetical purchase of current player
  const hypotheticalCounts = { ...currentGroupCounts };
  const curGroupUpper = (currentPlayerGroup || '').toUpperCase();
  if (curGroupUpper in hypotheticalCounts) {
    hypotheticalCounts[curGroupUpper]++;
  }

  let totalReserve = 0;
  const remainingRequirements: Record<string, number> = {};
  const groupReserves: Record<string, number> = {};

  groupRules.forEach(rule => {
    const gName = rule.group_name.toUpperCase();
    const owned = hypotheticalCounts[gName] || 0;
    const minRequired = rule.min_players;
    const remaining = Math.max(0, minRequired - owned);

    remainingRequirements[gName] = remaining;
    const reserve = remaining * rule.base_price;
    groupReserves[gName] = reserve;
    totalReserve += reserve;
  });

  const hardSafeLimit = Math.max(0, franchiseState.remainingPurse - totalReserve);

  // Return structure matching section 8 & section 26 business specifications
  return {
    groupARequired: remainingRequirements['GROUP A'] || 0,
    groupBRequired: remainingRequirements['GROUP B'] || 0,
    groupCRequired: remainingRequirements['GROUP C'] || 0,

    groupAReserve: groupReserves['GROUP A'] || 0,
    groupBReserve: groupReserves['GROUP B'] || 0,
    groupCReserve: groupReserves['GROUP C'] || 0,

    totalReserve,
    hardSafeLimit,

    // Generalized structure
    remainingRequirements: {
      groupA: remainingRequirements['GROUP A'] || 0,
      groupB: remainingRequirements['GROUP B'] || 0,
      groupC: remainingRequirements['GROUP C'] || 0,
      ...Object.fromEntries(
        Object.entries(remainingRequirements).map(([k, v]) => [
          k.toLowerCase().replace(/\s+([a-z])/g, (_, letter) => letter.toUpperCase()).replace(/[^a-zA-Z0-9]/g, ''),
          v
        ])
      )
    }
  };
}

export function calculateHardSafeLimit(params: CalculatorParams) {
  const { wallet, squad, currentPlayerGroup, customRulesJson } = params;

  const result = calculateMinimumFutureReserve(
    { squad, remainingPurse: wallet },
    currentPlayerGroup,
    { custom_rules_json: customRulesJson }
  );

  return {
    hardSafeLimit: result.hardSafeLimit,
    minimumFutureReserve: result.totalReserve,
    currentWallet: wallet,
    remainingRequirements: result.remainingRequirements
  };
}
