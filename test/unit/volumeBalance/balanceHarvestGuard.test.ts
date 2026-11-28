import { describe, expect, it } from 'vitest';
import { createBalanceHarvestGuard } from '@/services/volumeBalance/balanceHarvestGuard';
import type { BalanceMeter } from '@/services/volumeBalance/balanceMeter';

// A deck can report the same finished play from both ended and transition settlement.
describe('balance harvest guard', () => {
    it('harvests each play once per meter, including a subsequent loop or source', () => {
        let play = 1;
        const first = { plays: () => play } as BalanceMeter;
        const second = { plays: () => play } as BalanceMeter;
        const claim = createBalanceHarvestGuard();
        expect(claim(first)).toBe(true);
        expect(claim(first)).toBe(false);
        expect(claim(second)).toBe(true);
        play += 1;
        expect(claim(first)).toBe(true);
        expect(claim(first)).toBe(false);
    });
});
