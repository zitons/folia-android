// src/platform/runtime.ts
// Lightweight runtime checks shared by platform-only features.

const getCapacitorPlatform = (): string | undefined => {
    if (typeof window === 'undefined') return undefined;
    const capacitor = (window as unknown as {
        Capacitor?: { getPlatform?: () => string };
    }).Capacitor;
    return capacitor?.getPlatform?.();
};

export const isCapacitorAndroid = (): boolean => getCapacitorPlatform() === 'android';
export const isCapacitorIos = (): boolean => getCapacitorPlatform() === 'ios';
