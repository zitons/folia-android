import { isCapacitorIos } from '../../../platform/runtime';
import { normalizeIosApiEndpoint, readIosSourcePreferences, type IosApiSource } from '../../../stores/iosSourcePreferences';
import type { WebSourceEnv } from './foliumWebSource';

export const scopeIosNativeSource = (env: WebSourceEnv): WebSourceEnv => {
    if (!isCapacitorIos()) return env;
    return { ...env, pageStore: sourceId => env.pageStore(`ios-native:${sourceId}`) };
};

export const resolveWebSourceConnection = (env: WebSourceEnv, source: IosApiSource, defaultBase: string, fallbackIosBase = '') => {
    if (!isCapacitorIos()) return { env, apiBase: defaultBase };

    const apiBase = readIosSourcePreferences().endpoints[source]
        || normalizeIosApiEndpoint(defaultBase)
        || fallbackIosBase;
    const scope = encodeURIComponent(apiBase);
    return {
        apiBase,
        env: {
            ...env,
            // Old unscoped sessions have no server identity. Require sign-in for each new scope.
            pageStore: (sourceId: string) => env.pageStore(`ios-api:${scope}:${sourceId}`),
        },
    };
};
