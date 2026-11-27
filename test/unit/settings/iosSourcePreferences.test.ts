import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAvailableSettingsSectionIds } from '../../../src/components/modal/settings/navigation/settingsLastSection';
import { resolveWebSourceConnection, scopeIosNativeSource } from '../../../src/services/onlineMusic/web/iosWebSource';
import type { WebSourceEnv } from '../../../src/services/onlineMusic/web/foliumWebSource';
import { normalizeIosApiEndpoint, readIosSourcePreferences, saveIosSourcePreferences } from '../../../src/stores/iosSourcePreferences';

beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('window', { Capacitor: { getPlatform: () => 'ios' } });
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('iOS source settings', () => {
    it('defaults to external and lets a saved choice override the build configuration', () => {
        vi.stubEnv('VITE_IOS_NATIVE_SOURCES', '');
        expect(readIosSourcePreferences().mode).toBe('external');
        vi.stubEnv('VITE_IOS_NATIVE_SOURCES', 'true');
        expect(readIosSourcePreferences().mode).toBe('native');
        expect(getAvailableSettingsSectionIds({ isElectron: false })).toContain('sources');
        saveIosSourcePreferences({ mode: 'external', endpoints: { netease: 'https://music.example.test/api/', kugou: '', qq: '' } });
        expect(readIosSourcePreferences()).toEqual({
            mode: 'external', endpoints: { netease: 'https://music.example.test/api', kugou: '', qq: '' },
        });
    });

    it('allows an HTTPS base path and rejects URL credentials, query and fragment', () => {
        expect(normalizeIosApiEndpoint(' https://music.example.test/api/ ')).toBe('https://music.example.test/api');
        expect(normalizeIosApiEndpoint('')).toBe('');
        for (const invalid of [
            'music.example.test', 'http://music.example.test', 'https://me:secret@music.example.test',
            'https://music.example.test/?q=1', 'https://music.example.test/#section',
            'https://music.example.test/?', 'https://music.example.test/#',
        ]) {
            expect(normalizeIosApiEndpoint(invalid)).toBeNull();
        }
    });

    it('gives each API base path its own session storage and falls back when the address is blank', () => {
        const pageStore = vi.fn<WebSourceEnv['pageStore']>();
        const env: WebSourceEnv = {
            modId: 'test', pageStore,
            call: vi.fn(), text: vi.fn(), translate: vi.fn(), error: vi.fn(), isPureMusicText: vi.fn(),
        };
        const defaultBase = 'https://music.example.test/default';
        const initial = resolveWebSourceConnection(env, 'netease', defaultBase);
        expect(initial.apiBase).toBe(defaultBase);
        initial.env.pageStore('netease');
        const initialKey = pageStore.mock.calls[0][0];

        saveIosSourcePreferences({ mode: 'external', endpoints: { netease: 'https://music.example.test/custom', kugou: '', qq: '' } });
        const custom = resolveWebSourceConnection(env, 'netease', defaultBase);
        expect(custom.apiBase).toBe('https://music.example.test/custom');
        custom.env.pageStore('netease');
        expect(pageStore.mock.calls[1][0]).not.toBe(initialKey);
        expect(pageStore.mock.calls[1][0]).not.toBe('netease');
    });

    it('preserves the shipped NetEase server session and keeps it out of native mode', () => {
        const pageStore = vi.fn<WebSourceEnv['pageStore']>();
        const env: WebSourceEnv = {
            modId: 'test', pageStore,
            call: vi.fn(), text: vi.fn(), translate: vi.fn(), error: vi.fn(), isPureMusicText: vi.fn(),
        };
        const previousBase = 'https://api-enhanced-eosin-one.vercel.app';
        const connection = resolveWebSourceConnection(env, 'netease', '', previousBase);
        expect(connection.apiBase).toBe(previousBase);
        connection.env.pageStore('netease');
        expect(pageStore).toHaveBeenLastCalledWith('netease');
        scopeIosNativeSource(env).pageStore('netease');
        expect(pageStore).toHaveBeenLastCalledWith('ios-native:netease');
        saveIosSourcePreferences({ mode: 'external', endpoints: { netease: 'https://other.example.test', kugou: '', qq: '' } });
        resolveWebSourceConnection(env, 'netease', previousBase, previousBase).env.pageStore('netease');
        expect(pageStore).toHaveBeenLastCalledWith('ios-api:https%3A%2F%2Fother.example.test:netease');
    });
});
