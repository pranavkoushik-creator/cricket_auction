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
    { group_name: "GROUP B", base_price: 50000, min_players: 2, max_players: 3 },
    { group_name: "GROUP C", base_price: 25000, min_players: 2, max_players: 3 }
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

  const remainingRequirements: Record<string, number> = {};
  const groupReserves: Record<string, number> = {};

  const ruleA = groupRules.find(r => r.group_name.toUpperCase() === 'GROUP A') || { base_price: 100000, min_players: 2, max_players: 2 };
  const ruleB = groupRules.find(r => r.group_name.toUpperCase() === 'GROUP B') || { base_price: 50000, min_players: 2, max_players: 3 };
  const ruleC = groupRules.find(r => r.group_name.toUpperCase() === 'GROUP C') || { base_price: 25000, min_players: 2, max_players: 3 };

  const a_hyp = hypotheticalCounts['GROUP A'] || 0;
  const b_hyp = hypotheticalCounts['GROUP B'] || 0;
  const c_hyp = hypotheticalCounts['GROUP C'] || 0;

  const a_needed = Math.max(0, ruleA.min_players - a_hyp);
  const b_needed = Math.max(0, ruleB.min_players - b_hyp);
  const c_needed = Math.max(0, ruleC.min_players - c_hyp);

  let a_reserve = a_needed * ruleA.base_price;
  let b_reserve = b_needed * ruleB.base_price;
  let c_reserve = c_needed * ruleC.base_price;

  let total_hyp = a_hyp + b_hyp + c_hyp;
  let slotsToFill = Math.max(0, 7 - total_hyp);
  let extraSlots = Math.max(0, slotsToFill - (a_needed + b_needed + c_needed));

  if (extraSlots > 0) {
    const maxGroupBExtra = Math.max(0, (ruleB.max_players || 3) - (b_hyp + b_needed));
    const bExtra = Math.min(extraSlots, maxGroupBExtra);
    const cExtra = extraSlots - bExtra;

    c_reserve += cExtra * ruleC.base_price;
    b_reserve += bExtra * ruleB.base_price;
  }

  let totalReserve = a_reserve + b_reserve + c_reserve;

  remainingRequirements['GROUP A'] = a_needed;
  remainingRequirements['GROUP B'] = b_needed;
  remainingRequirements['GROUP C'] = c_needed;

  groupReserves['GROUP A'] = a_reserve;
  groupReserves['GROUP B'] = b_reserve;
  groupReserves['GROUP C'] = c_reserve;

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
