import assert from 'assert';
import { calculateHardSafeLimit } from '../services/hardSafeLimitCalculator';

const customRulesJson = {
  group_rules: [
    { group_name: "GROUP A", base_price: 100000, min_players: 2, max_players: 2 },
    { group_name: "GROUP B", base_price: 50000, min_players: 2, max_players: 2 },
    { group_name: "GROUP C", base_price: 25000, min_players: 3, max_players: 3 }
  ],
  bid_increments: [5000, 10000, 25000, 50000]
};

function runUnitTests() {
  console.log('Running Hard Safe Limit Unit Tests...');

  // Case 1 & Case 2: Initial state, exact limit and limit + 1
  // Wallet = 1,000,000, squad = empty, currentPlayer = GROUP A
  // Reserve required after purchase: A = 1, B = 2, C = 3
  // Reserve cost: 1 * 100,000 + 2 * 50,000 + 3 * 25,000 = 275,000
  // Hard limit = 1,000,000 - 275,000 = 725,000
  {
    const params = {
      wallet: 1000000,
      squad: [],
      currentPlayerGroup: 'GROUP A',
      customRulesJson
    };
    const res = calculateHardSafeLimit(params);
    assert.strictEqual(res.minimumFutureReserve, 275000, 'Case 1 Reserve should be 275k');
    assert.strictEqual(res.hardSafeLimit, 725000, 'Case 1 Limit should be 725k');
    
    // Exact limit
    assert.ok(725000 <= res.hardSafeLimit, 'Case 1: Bid of 725k should be ALLOWED');
    // Limit + 1
    assert.ok(725001 > res.hardSafeLimit, 'Case 2: Bid of 725,001 should be BLOCKED');
    console.log('✔ Case 1 & 2 (Exact limit & limit + 1) passed.');
  }

  // Let's test a case where we have: A = 1, B = 0, C = 0, Wallet = 800,000
  // Current player = GROUP A
  // After purchase: A = 2
  // Future reserve required: B = 2, C = 3 -> 175,000
  // Limit: 800,000 - 175,000 = 625,000
  {
    const params = {
      wallet: 800000,
      squad: [{ group_name: 'GROUP A', sold_price: 200000 }],
      currentPlayerGroup: 'GROUP A',
      customRulesJson
    };
    const res = calculateHardSafeLimit(params);
    assert.strictEqual(res.minimumFutureReserve, 175000, 'Case 4 Reserve should be 175k');
    assert.strictEqual(res.hardSafeLimit, 625000, 'Case 4 Limit should be 625k');
    console.log('✔ Case 4 (Limit calculation with A=1) passed.');
  }

  // Case 4: Final player check
  // Franchise has: A=2, B=2, C=2, wallet = 300,000
  // Current player = GROUP C
  // After purchase: C = 3
  // Future reserve required: 0 (since team is complete: A=2, B=2, C=3)
  // Limit: 300,000
  {
    const params = {
      wallet: 300000,
      squad: [
        { group_name: 'GROUP A', sold_price: 200000 },
        { group_name: 'GROUP A', sold_price: 200000 },
        { group_name: 'GROUP B', sold_price: 100000 },
        { group_name: 'GROUP B', sold_price: 100000 },
        { group_name: 'GROUP C', sold_price: 50000 },
        { group_name: 'GROUP C', sold_price: 50000 }
      ],
      currentPlayerGroup: 'GROUP C',
      customRulesJson
    };
    const res = calculateHardSafeLimit(params);
    assert.strictEqual(res.minimumFutureReserve, 0, 'Reserve should be 0 for completed team');
    assert.strictEqual(res.hardSafeLimit, 300000, 'Limit should be 300k');
    console.log('✔ Case 4 (Final player check) passed.');
  }

  // Case 6: Wallet exactly equals reserve (hard limit = 0)
  // Wallet = 125,000, B = 0, C = 0. Squad has A=2
  // Current player = GROUP B
  // After purchase: B = 1. Remaining required: B = 1, C = 3
  // Future reserve required: 1 * 50,000 + 3 * 25,000 = 125,000
  // Limit: 125,000 - 125,000 = 0
  {
    const params = {
      wallet: 125000,
      squad: [
        { group_name: 'GROUP A', sold_price: 400000 },
        { group_name: 'GROUP A', sold_price: 425000 }
      ],
      currentPlayerGroup: 'GROUP B',
      customRulesJson
    };
    const res = calculateHardSafeLimit(params);
    assert.strictEqual(res.minimumFutureReserve, 125000, 'Reserve should be 125k');
    assert.strictEqual(res.hardSafeLimit, 0, 'Limit should be 0');
    console.log('✔ Case 6 (Wallet exactly equals reserve) passed.');
  }

  // Case 7: Wallet below reserve (Financial Risk)
  // Wallet = 100,000, reserve = 125,000
  // limit is 0, wallet < reserve (financial risk check)
  {
    const params = {
      wallet: 10000,
      squad: [
        { group_name: 'GROUP A', sold_price: 450000 },
        { group_name: 'GROUP A', sold_price: 450000 }
      ],
      currentPlayerGroup: 'GROUP B',
      customRulesJson
    };
    const res = calculateHardSafeLimit(params);
    assert.strictEqual(res.minimumFutureReserve, 125000, 'Reserve should be 125k');
    assert.strictEqual(res.hardSafeLimit, 0, 'Limit should be 0');
    assert.ok(res.currentWallet < res.minimumFutureReserve, 'Current wallet should be less than reserve');
    console.log('✔ Case 7 (Wallet below reserve) passed.');
  }

  console.log('All Hard Safe Limit Unit Tests Completed Successfully!');
}

runUnitTests();
