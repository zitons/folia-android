import type { BalanceMeter } from './balanceMeter';

// One deck play can reach both the media ended event and Automix settlement.
export const createBalanceHarvestGuard = () => {
    const harvested = new WeakMap<BalanceMeter, number>();
    return (meter: BalanceMeter): boolean => {
        const play = meter.plays();
        if (harvested.get(meter) === play) return false;
        harvested.set(meter, play);
        return true;
    };
};
