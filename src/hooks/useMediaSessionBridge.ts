import { useEffect } from 'react';
import type { RefObject } from 'react';
import { Capacitor } from '@capacitor/core';
import { PlayerState } from '../types';
import type { SongResult } from '../types';
import { getSongAlbumLabel, getSongArtistLabel, getSongCoverUrl } from '../services/onlineMusic/songMetadata';
import {
    createMediaSessionPositionState,
    getSupportedMediaSessionArtworkUrl,
    isMediaSessionSourceReady,
    publishMediaSessionTrack,
} from '../utils/mediaSessionSync';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { useHifiTrackStore } from '../services/hifi/hifiPlayback';
import { getObservedMedia } from '../services/hifi/hifiMediaShim';

// Bridges Folia playback state to the browser Media Session API.
export type UseMediaSessionBridgeOptions = {
    audioRef: RefObject<HTMLAudioElement | null>;
    /**
     * The deck the displayed track is playing on, or null when the picture is live.
     *
     * Metadata, clock and source have to describe the same deck. `currentSong` is already the
     * DISPLAYED track - the outgoing one for the length of a blend - while `audioRef` names the
     * active deck, which by then is the arriving track. Publishing the two together put the outgoing
     * track's title on the incoming track's duration and position, so the system panel showed one
     * song's name over another song's progress. `audioSrc` is passed to match this element.
     */
    getDisplayAudioElement?: () => HTMLAudioElement | null;
    seekDuringTransition?: (time: number) => boolean;
    audioSrc: string | null;
    currentSong: SongResult | null;
    cachedCoverUrl: string | null;
    playerState: PlayerState;
    isNowPlayingStageActive: boolean;
    unknownArtistLabel: string;
    mediaSessionPlayRef: RefObject<() => Promise<void>>;
    mediaSessionPauseRef: RefObject<() => void>;
    mediaSessionPrevRef: RefObject<() => void>;
    mediaSessionNextRef: RefObject<() => Promise<void> | void>;
    isNowPlayingControlDisabledRef: RefObject<boolean>;
};

export const useMediaSessionBridge = ({
    audioRef,
    getDisplayAudioElement,
    seekDuringTransition,
    audioSrc,
    currentSong,
    cachedCoverUrl,
    playerState,
    isNowPlayingStageActive,
    unknownArtistLabel,
    mediaSessionPlayRef,
    mediaSessionPauseRef,
    mediaSessionPrevRef,
    mediaSessionNextRef,
    isNowPlayingControlDisabledRef,
}: UseMediaSessionBridgeOptions) => {
    // On the HiFi route mpv sounds the song: the position comes off the HiFi media shim, and its
    // source (one per HiFi track) stands in for `audioSrc`, which is null there.
    const playbackRoute = usePlaybackStore(state => state.playbackRoute);
    const hifiTrackKey = useHifiTrackStore(state => state.current?.trackKey ?? null);
    const followsAudioState = Capacitor.getPlatform() === 'ios'
        && playbackRoute === 'web'
        && !isNowPlayingStageActive;

    useEffect(() => {
        if (!('mediaSession' in navigator)) {
            return;
        }

        const mediaSession = navigator.mediaSession;
        const setActionHandlerSafely = (
            action: MediaSessionAction,
            handler: MediaSessionActionHandler | null
        ) => {
            try {
                mediaSession.setActionHandler(action, handler);
            } catch (e) {
                console.warn(`[MediaSession] Failed to bind ${action} handler`, e);
            }
        };

        setActionHandlerSafely('play', async () => {
            if (isNowPlayingControlDisabledRef.current || !audioRef.current) {
                return;
            }

            try {
                await mediaSessionPlayRef.current();
            } catch (e) {
                console.error('MediaSession play failed', e);
            }
        });
        setActionHandlerSafely('pause', () => {
            if (isNowPlayingControlDisabledRef.current || !audioRef.current) {
                return;
            }

            mediaSessionPauseRef.current();
        });
        setActionHandlerSafely('previoustrack', () => {
            if (isNowPlayingControlDisabledRef.current) {
                return;
            }
            mediaSessionPrevRef.current();
        });
        setActionHandlerSafely('nexttrack', () => {
            if (isNowPlayingControlDisabledRef.current) {
                return;
            }
            void mediaSessionNextRef.current();
        });

        return () => {
            setActionHandlerSafely('play', null);
            setActionHandlerSafely('pause', null);
            setActionHandlerSafely('previoustrack', null);
            setActionHandlerSafely('nexttrack', null);
        };
    }, [audioRef, isNowPlayingControlDisabledRef, mediaSessionNextRef, mediaSessionPauseRef, mediaSessionPlayRef, mediaSessionPrevRef]);

    useEffect(() => {
        if (!('mediaSession' in navigator)) {
            return;
        }

        if (!currentSong) {
            try {
                if (followsAudioState) navigator.mediaSession.playbackState = 'none';
                navigator.mediaSession.setPositionState();
                navigator.mediaSession.metadata = null;
            } catch (e) {
                console.warn('[MediaSession] Failed to clear metadata', e);
            }
            return;
        }

        // The displayed track's own deck, so the position published below belongs to the title
        // published beside it. Falls back to the active deck whenever no blend is holding a picture.
        const deck = getDisplayAudioElement?.() ?? audioRef.current;
        const audio = getObservedMedia(deck);
        // The shim switched to this track before the track store named it, so its source is current here.
        // On every non-web route (mpv, the provider's own player) that is its shim's source, not a URL.
        const expectedSource = playbackRoute === 'web' ? audioSrc : getObservedMedia(null)?.currentSrc;
        const syncAudioState = () => {
            try {
                if (!audio || !expectedSource || !isMediaSessionSourceReady(audio, expectedSource, document.baseURI)) {
                    navigator.mediaSession.playbackState = 'paused';
                    navigator.mediaSession.setPositionState?.();
                    return;
                }
                navigator.mediaSession.playbackState = audio.paused || audio.ended || deck?.error ? 'paused' : 'playing';
                const position = createMediaSessionPositionState(audio);
                if (position) navigator.mediaSession.setPositionState(position);
            } catch (e) {
                console.warn('[MediaSession] Failed to synchronize audio state', e);
            }
        };
        if (!audio || !expectedSource) {
            if (followsAudioState) syncAudioState();
            return;
        }

        let disposed = false;
        const sourceArtworkUrl = cachedCoverUrl || getSongCoverUrl(currentSong) || '';
        let artworkUrl = getSupportedMediaSessionArtworkUrl(sourceArtworkUrl, document.baseURI);
        let disposableArtworkUrl: string | null = null;
        const publish = () => {
            if (disposed || !isMediaSessionSourceReady(audio, expectedSource, document.baseURI)) {
                return;
            }

            try {
                publishMediaSessionTrack(navigator.mediaSession, audio, {
                    title: currentSong.name,
                    artist: getSongArtistLabel(currentSong) || unknownArtistLabel,
                    album: getSongAlbumLabel(currentSong),
                    artworkUrl,
                });
            } catch (e) {
                console.warn('[MediaSession] Failed to update metadata', e);
            }
        };

        // MediaMetadata rejects Electron's custom protocol, so expose that image through a
        // short-lived blob URL while this track owns the platform media session.
        const prepareUnsupportedArtwork = async () => {
            if (!sourceArtworkUrl || artworkUrl) return;

            try {
                const response = await fetch(sourceArtworkUrl);
                if (!response.ok) throw new Error(`Artwork request failed: ${response.status}`);
                const artworkBlob = await response.blob();
                if (artworkBlob.size <= 0 || !artworkBlob.type.startsWith('image/')) {
                    throw new Error('Artwork response is not a valid image');
                }

                const objectUrl = URL.createObjectURL(artworkBlob);
                if (disposed) {
                    URL.revokeObjectURL(objectUrl);
                    return;
                }
                disposableArtworkUrl = objectUrl;
                artworkUrl = objectUrl;
                publish();
            } catch (e) {
                if (!disposed) console.warn('[MediaSession] Failed to prepare artwork', e);
            }
        };

        audio.addEventListener('loadedmetadata', publish);
        audio.addEventListener('durationchange', publish);
        // Re-publish after playback starts in case Chromium delivered a late clear from the old source.
        audio.addEventListener('playing', publish);
        const audioStateEvents = ['emptied', 'loadedmetadata', 'durationchange', 'playing', 'pause', 'ended', 'error', 'seeked', 'ratechange'];
        if (followsAudioState) {
            try {
                navigator.mediaSession.setActionHandler('seekto', ({ seekTime, fastSeek }) => {
                    if (!deck || seekTime === undefined || !Number.isFinite(seekTime)
                        || isNowPlayingControlDisabledRef.current
                        || !isMediaSessionSourceReady(deck, expectedSource, document.baseURI)) return;

                    const position = Math.max(0, Math.min(deck.duration, seekTime));
                    if (seekDuringTransition?.(position)) return;
                    if (fastSeek && typeof deck.fastSeek === 'function') deck.fastSeek(position);
                    else deck.currentTime = position;
                });
            } catch (e) {
                console.warn('[MediaSession] Failed to bind seek handler', e);
            }
            audioStateEvents.forEach(event => audio.addEventListener(event, syncAudioState));
            document.addEventListener('visibilitychange', syncAudioState);
            window.addEventListener('pageshow', syncAudioState);
            syncAudioState();
        }
        publish();
        void prepareUnsupportedArtwork();

        return () => {
            disposed = true;
            audio.removeEventListener('loadedmetadata', publish);
            audio.removeEventListener('durationchange', publish);
            audio.removeEventListener('playing', publish);
            if (followsAudioState) {
                try {
                    navigator.mediaSession.setActionHandler('seekto', null);
                } catch {
                    // Some WebKit versions do not expose this action.
                }
                audioStateEvents.forEach(event => audio.removeEventListener(event, syncAudioState));
                document.removeEventListener('visibilitychange', syncAudioState);
                window.removeEventListener('pageshow', syncAudioState);
            }
            if (disposableArtworkUrl) URL.revokeObjectURL(disposableArtworkUrl);
        };
    }, [audioRef, audioSrc, cachedCoverUrl, currentSong, followsAudioState, getDisplayAudioElement, hifiTrackKey, isNowPlayingControlDisabledRef, playbackRoute, seekDuringTransition, unknownArtistLabel]);

    useEffect(() => {
        if (followsAudioState || !('mediaSession' in navigator)) {
            return;
        }

        try {
            navigator.mediaSession.playbackState = isNowPlayingStageActive
                ? 'none'
                : currentSong
                    ? (playerState === PlayerState.PLAYING ? 'playing' : 'paused')
                    : 'none';
        } catch (e) {
            console.warn('[MediaSession] Failed to update playback state', e);
        }
    }, [currentSong, followsAudioState, isNowPlayingStageActive, playerState]);
};
