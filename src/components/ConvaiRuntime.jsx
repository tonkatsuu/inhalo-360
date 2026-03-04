import { useEffect, useRef } from 'react'
import { readConvaiConfig } from '../convai/config'
import { useConvaiNpc } from '../hooks/useConvaiNpc'
import { ConvaiPanel } from './ConvaiPanel'

function InvalidConvaiRuntime({ config, isDev }) {
    const warnedRef = useRef(false)

    useEffect(() => {
        if (!isDev) {
            return undefined
        }

        if (!warnedRef.current) {
            console.warn(
                `Convai is enabled but missing required configuration: ${config.missingKeys.join(', ')}.`,
            )
            warnedRef.current = true
        }

        window.__INHALO_CONVAI__ = {
            enabled: true,
            isConfigured: false,
            missingKeys: [...config.missingKeys],
        }

        return () => {
            delete window.__INHALO_CONVAI__
        }
    }, [config.missingKeys, isDev])

    return (
        <ConvaiPanel
            enabled={config.enabled}
            isConfigured={false}
            missingKeys={config.missingKeys}
            isAudioMuted
        />
    )
}

function ActiveConvaiRuntime({ config, isDev }) {
    const { state, audioControls, connect, disconnect, mute, unmute } = useConvaiNpc({
        apiKey: config.apiKey,
        characterId: config.characterId,
    })
    const isAudioMuted = audioControls?.isAudioMuted ?? true

    useEffect(() => {
        if (!isDev) {
            return undefined
        }

        window.__INHALO_CONVAI__ = {
            enabled: true,
            isConfigured: true,
            state,
            connect,
            disconnect,
            mute,
            unmute,
        }

        return () => {
            delete window.__INHALO_CONVAI__
        }
    }, [connect, disconnect, isDev, mute, state, unmute])

    return (
        <ConvaiPanel
            enabled={config.enabled}
            isConfigured
            state={state}
            isThinking={state?.isThinking === true}
            isSpeaking={state?.isSpeaking === true}
            isAudioMuted={isAudioMuted}
            onConnect={connect}
            onDisconnect={disconnect}
            onMute={mute}
            onUnmute={unmute}
        />
    )
}

export function ConvaiRuntime({ config }) {
    const isDev = readConvaiConfig.isDev === true

    if (!config.enabled) {
        return null
    }

    if (!config.isConfigured) {
        return <InvalidConvaiRuntime config={config} isDev={isDev} />
    }

    return <ActiveConvaiRuntime config={config} isDev={isDev} />
}
