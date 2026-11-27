import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isCapacitorIos } from '../../../../../platform/runtime';
import {
    IOS_API_SOURCES, normalizeIosApiEndpoint, readIosSourcePreferences, saveIosSourcePreferences,
    type IosSourceMode,
} from '../../../../../stores/iosSourcePreferences';
import { Button, Group, Row, Segmented, Status, TextField, option, type SettingsGroupDef } from '../../kit';

const CONNECTION: SettingsGroupDef = {
    id: 'iosSourceConnection', titleKey: 'sourcesSettings.iosConnection', available: isCapacitorIos,
};
const MODE = option(CONNECTION, 'iosSourceMode', 'sourcesSettings.iosMode');
const ENDPOINTS = {
    netease: option(CONNECTION, 'iosNeteaseEndpoint', 'lyricProvider.netease'),
    kugou: option(CONNECTION, 'iosKugouEndpoint', 'lyricProvider.kugou'),
    qq: option(CONNECTION, 'iosQqEndpoint', 'lyricProvider.qq'),
};
export const IOS_SOURCE_OPTIONS = [MODE, ...Object.values(ENDPOINTS)];

export const IosSourceConnection = () => {
    const { t } = useTranslation();
    const [draft, setDraft] = useState(readIosSourcePreferences);
    const [error, setError] = useState<'invalid' | 'save' | null>(null);

    const save = () => {
        const endpoints = { ...draft.endpoints };
        for (const source of IOS_API_SOURCES) {
            const endpoint = normalizeIosApiEndpoint(endpoints[source]);
            if (endpoint === null) {
                setError('invalid');
                return;
            }
            endpoints[source] = endpoint;
        }
        try {
            saveIosSourcePreferences({ mode: draft.mode, endpoints });
        } catch {
            setError('save');
            return;
        }
        window.location.reload();
    };

    return (
        <Group def={CONNECTION}>
            <Row option={MODE} hint={t('sourcesSettings.iosModeHint')}>
                <Segmented<IosSourceMode>
                    value={draft.mode}
                    options={[
                        { value: 'native', label: t('sourcesSettings.iosNative') },
                        { value: 'external', label: t('sourcesSettings.iosExternal') },
                    ]}
                    onChange={mode => setDraft(current => ({ ...current, mode }))}
                />
            </Row>
            {IOS_API_SOURCES.map(source => (
                <Row key={source} option={ENDPOINTS[source]}>
                    <TextField
                        type="url"
                        placeholder="https://"
                        value={draft.endpoints[source]}
                        onChange={endpoint => {
                            setError(null);
                            setDraft(current => ({ ...current, endpoints: { ...current.endpoints, [source]: endpoint } }));
                        }}
                    />
                </Row>
            ))}
            <Row label={error ? <Status tone="error">{t(error === 'invalid' ? 'sourcesSettings.iosInvalidUrl' : 'sourcesSettings.iosSaveFailed')}</Status> : undefined}>
                <Button variant="primary" onClick={save}>{t('sourcesSettings.iosApply')}</Button>
            </Row>
        </Group>
    );
};
