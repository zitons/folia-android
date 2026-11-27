import { isCapacitorIos } from '../../../platform/runtime';
import { normalizeIosApiEndpoint, readIosSourcePreferences, type IosApiSource } from '../../../stores/iosSourcePreferences';
import type { WebSourceEnv } from './foliumWebSource';

export const scopeIosNativeSource = (env: WebSourceEnv): WebSourceEnv => {
    if (!isCapacitorIos()) return env;
    return { ...env, pageStore: sourceId => env.pageStore(`ios-native:${sourceId}`) };
};

export const resolveWebSourceConnection = (env: WebSourceEnv, source: IosApiSource, defaultBase: string, legacyIosBase?: string) => {
    if (!isCapacitorIos()) return { env, apiBase: defaultBase };

    const apiBase = readIosSourcePreferences().endpoints[source] || (normalizeIosApiEndpoint(defaultBase) ?? '');
    // Keep the previously shipped server's sign-in in its original store. Other servers never read it.
    if (legacyIosBase && apiBase === legacyIosBase) return { env, apiBase };
    const scope = encodeURIComponent(apiBase);
    return {
        apiBase,
        env: {
            ...env,
            // Cookies provided to one API server must stay with that endpoint.
            pageStore: (sourceId: string) => env.pageStore(`ios-api:${scope}:${sourceId}`),
        },
    };
};
