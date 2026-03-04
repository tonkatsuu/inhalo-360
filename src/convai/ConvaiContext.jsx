import { useMemo } from 'react'
import { useConvaiNpc } from '../hooks/useConvaiNpc'
import { ConvaiContext, defaultConvaiRuntime } from './runtime-context'

function ActiveConvaiProvider({ config, children }) {
    const runtime = useConvaiNpc({
        apiKey: config.apiKey,
        characterId: config.characterId,
    })

    const value = useMemo(
        () => ({
            enabled: true,
            isConfigured: true,
            missingKeys: [],
            ...runtime,
        }),
        [runtime],
    )

    return <ConvaiContext.Provider value={value}>{children}</ConvaiContext.Provider>
}

export function ConvaiProvider({ config, children }) {
    if (config.enabled && config.isConfigured) {
        return <ActiveConvaiProvider config={config}>{children}</ActiveConvaiProvider>
    }

    const value = {
        ...defaultConvaiRuntime,
        enabled: config.enabled,
        isConfigured: config.isConfigured,
        missingKeys: config.missingKeys,
    }

    return <ConvaiContext.Provider value={value}>{children}</ConvaiContext.Provider>
}
