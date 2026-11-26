import { afterEach, describe, expect, it, vi } from 'vitest';
import { isCapacitorAndroid } from '../../../src/platform/runtime';

afterEach(() => vi.unstubAllGlobals());

describe('isCapacitorAndroid', () => {
    it.each([
        ['android', true, true],
        ['ios', true, false],
        ['web', false, false],
    ])('checks the Capacitor platform for %s', (platform, native, expected) => {
        vi.stubGlobal('window', {
            Capacitor: { getPlatform: () => platform, isNativePlatform: () => native },
        });
        expect(isCapacitorAndroid()).toBe(expected);
    });

    it('returns false without Capacitor', () => {
        vi.stubGlobal('window', {});
        expect(isCapacitorAndroid()).toBe(false);
    });
});
