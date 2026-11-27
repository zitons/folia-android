import { afterEach, describe, expect, it, vi } from 'vitest';

const cdnUrl = 'https://audio.example.test/track.mp3';
const playableUrl = 'capacitor://localhost/_capacitor_file_/track.mp3';

const bridgeWith = async (mode: string, playable: boolean) => {
    vi.resetModules();
    vi.stubEnv('VITE_IOS_NATIVE_SOURCES', mode);
    const fetch = vi.fn().mockImplementation(async () => {
        if (!playable) throw new TypeError('CORS');
        return new Response(null, { status: 206 });
    });
    const registerRemoteAudio = vi.fn().mockResolvedValue({ url: playableUrl });
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('window', {
        Capacitor: { getPlatform: () => 'ios', Plugins: { FoliaNative: { registerRemoteAudio } } },
    });
    vi.stubGlobal('localStorage', { getItem: () => null });
    const { proxyNativeRemoteAudioUrl } = await import('../../../src/services/nativeRemoteAudio');
    return { fetch, registerRemoteAudio, proxyNativeRemoteAudioUrl };
};

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('iOS CDN audio fallback', () => {
    it('keeps an externally configured source on its original playback path', async () => {
        const bridge = await bridgeWith('false', false);
        expect(await bridge.proxyNativeRemoteAudioUrl(cdnUrl)).toBe(cdnUrl);
        expect(bridge.fetch).not.toHaveBeenCalled();
        expect(bridge.registerRemoteAudio).not.toHaveBeenCalled();
    });

    it('streams directly if the WebView can read an anonymous range response', async () => {
        const bridge = await bridgeWith('true', true);
        expect(await bridge.proxyNativeRemoteAudioUrl(cdnUrl)).toBe(cdnUrl);
        expect(bridge.fetch).toHaveBeenCalledWith(cdnUrl, expect.objectContaining({
            headers: { Range: 'bytes=0-0' },
            credentials: 'omit',
        }));
        expect(bridge.registerRemoteAudio).not.toHaveBeenCalled();
    });

    it('uses native audio when the browser range request fails', async () => {
        const bridge = await bridgeWith('true', false);
        expect(await bridge.proxyNativeRemoteAudioUrl(cdnUrl)).toBe(playableUrl);
        expect(bridge.registerRemoteAudio).toHaveBeenCalledWith({ url: cdnUrl });
    });
});
