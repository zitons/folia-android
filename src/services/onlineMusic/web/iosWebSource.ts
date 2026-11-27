import { isCapacitorIos } from '../../../platform/runtime';
import { normalizeIosApiEndpoint, readIosSourcePreferences, type IosApiSource } from '../../../stores/iosSourcePreferences';
import type { WebSourceEnv } from './foliumWebSource';

export const resolveWebSourceConnection = (env: WebSourceEnv, source: IosApiSource, defaultBase: string) => {
    if (!isCapacitorIos()) return { env, apiBase: defaultBase };

    const apiBase = readIosSourcePreferences().endpoints[source] || (normalizeIosApiEndpoint(defaultBase) ?? '');
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
