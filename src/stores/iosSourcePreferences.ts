import { readStoredString, setStoredJson } from './storagePrimitives';

const STORAGE_KEY = 'folia_ios_source_preferences';

export const IOS_API_SOURCES = ['netease', 'kugou', 'qq'] as const;
export type IosApiSource = typeof IOS_API_SOURCES[number];
export type IosSourceMode = 'native' | 'external';

export interface IosSourcePreferences {
    mode: IosSourceMode;
    endpoints: Record<IosApiSource, string>;
}

export const normalizeIosApiEndpoint = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (!/^https:\/\//i.test(trimmed) || trimmed.includes('?') || trimmed.includes('#')) return null;
    try {
        const url = new URL(trimmed);
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
        return url.href.replace(/\/+$/, '');
    } catch {
        return null;
    }
};

export const readIosSourcePreferences = (): IosSourcePreferences => {
    const defaults: IosSourcePreferences = {
        mode: import.meta.env.VITE_IOS_NATIVE_SOURCES === 'true' ? 'native' : 'external',
        endpoints: { netease: '', kugou: '', qq: '' },
    };
    try {
        const stored = JSON.parse(readStoredString(STORAGE_KEY) ?? 'null') as Partial<IosSourcePreferences> | null;
        if (!stored || (stored.mode !== 'native' && stored.mode !== 'external')) return defaults;
        const { endpoints } = defaults;
        for (const source of IOS_API_SOURCES) {
            const endpoint = stored.endpoints?.[source];
            if (typeof endpoint === 'string') endpoints[source] = normalizeIosApiEndpoint(endpoint) ?? '';
        }
        return { mode: stored.mode, endpoints };
    } catch {
        return defaults;
    }
};

export const saveIosSourcePreferences = (preferences: IosSourcePreferences): void => {
    setStoredJson(STORAGE_KEY, preferences);
};
