import { useCallback, useEffect, useRef, useState } from 'react'
import { useConvaiClient } from '@convai/web-sdk/react'

const CAPTION_LINGER_MS = 3500
const AGENT_DISPLAY_NAME = 'Pharmacist Ava'
const AGENT_MESSAGE_TYPES = new Set(['convai', 'bot-llm-text'])

// Match the audio constraints Convai uses for startWithAudioOn:true.
// AudioManager.enableAudio() calls setMicrophoneEnabled(true) with NO constraints,
// so the browser may choose arbitrary defaults that degrade STT quality.
const MIC_CONSTRAINTS = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 1,
}


function getLatestAgentMessage(messages = []) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index]
        const content = typeof message?.content === 'string' ? message.content.trim() : ''
        if (!content) continue
        if (AGENT_MESSAGE_TYPES.has(message?.type)) {
            return {
                content,
                isStreaming: message?.isStreaming === true,
            }
        }
    }

    return null
}

function getInitialCaptionState() {
    return {
        agentCaptionText: '',
        agentCaptionVisible: false,
        agentCaptionIsStreaming: false,
        agentCaptionUpdatedAt: null,
    }
}

export function useConvaiNpc({ apiKey, characterId }) {
    const client = useConvaiClient({
        apiKey,
        characterId,
        enableVideo: false,
        startWithAudioOn: false,
        ttsEnabled: true,
        enableLipsync: true,
        blendshapeConfig: {
            format: 'arkit',
        },
    })
    const [captionState, setCaptionState] = useState(getInitialCaptionState)
    const [isMicOpen, setIsMicOpen] = useState(false)
    const lingerTimeoutRef = useRef(null)
    // Keep a ref so PTT callbacks are always stable (no re-render dependency).
    const clientRef = useRef(client)
    useEffect(() => { clientRef.current = client })

    const clearCaptionTimer = useCallback(() => {
        if (lingerTimeoutRef.current) {
            window.clearTimeout(lingerTimeoutRef.current)
            lingerTimeoutRef.current = null
        }
    }, [])

    const resetCaptionState = useCallback(() => {
        clearCaptionTimer()
        setCaptionState(getInitialCaptionState())
    }, [clearCaptionTimer])

    useEffect(() => {
        if (!client) {
            return undefined
        }

        const handleMessagesChange = (messages) => {
            const latestAgentMessage = getLatestAgentMessage(messages)
            if (!latestAgentMessage) {
                return
            }

            clearCaptionTimer()
            setCaptionState({
                agentCaptionText: latestAgentMessage.content,
                agentCaptionVisible: true,
                agentCaptionIsStreaming: latestAgentMessage.isStreaming,
                agentCaptionUpdatedAt: Date.now(),
            })
        }

        const handleTurnEnd = () => {
            clearCaptionTimer()
            lingerTimeoutRef.current = window.setTimeout(() => {
                setCaptionState((current) => ({
                    ...current,
                    agentCaptionVisible: false,
                    agentCaptionIsStreaming: false,
                }))
            }, CAPTION_LINGER_MS)
        }

        const unsubscribeMessages = client.on('messagesChange', handleMessagesChange)
        const unsubscribeTurnEnd = client.on('turnEnd', handleTurnEnd)
        const unsubscribeDisconnect = client.on('disconnect', resetCaptionState)
        const unsubscribeConnect = client.on('connect', resetCaptionState)

        // --- PTT debug (dev only) ---
        let unsubscribeTranscription
        let unsubscribeListening
        if (import.meta.env.DEV) {
            unsubscribeTranscription = client.on('userTranscriptionChange', (text) => {
                console.log('[Convai] userTranscription:', JSON.stringify(text))
            })
            unsubscribeListening = client.on('listeningChange', (isListening) => {
                console.log('[Convai] listeningChange:', isListening, '— at', new Date().toISOString())
            })
        }
        // ----------------------------

        return () => {
            unsubscribeMessages?.()
            unsubscribeTurnEnd?.()
            unsubscribeDisconnect?.()
            unsubscribeConnect?.()
            unsubscribeTranscription?.()
            unsubscribeListening?.()
            clearCaptionTimer()
        }
    }, [clearCaptionTimer, client, resetCaptionState])

    const getMicPublication = useCallback((lp) => {
        if (!lp) return null
        return Array.from(lp.audioTrackPublications.values())
            .find((p) => p.source === 'microphone' && p.track) ?? null
    }, [])

    const startRecord = useCallback(() => {
        const c = clientRef.current
        const lp = c?.room?.localParticipant
        if (!lp) {
            c?.audioControls?.unmuteAudio?.()
            setIsMicOpen(true)
            return
        }

        const existing = getMicPublication(lp)
        if (existing) {
            // Track already published (was soft-muted) — just unmute it.
            existing.track.unmute()
        } else {
            // First press: publish a new track with proper constraints.
            // AudioManager.enableAudio() passes no constraints, so we bypass it.
            lp.setMicrophoneEnabled(true, MIC_CONSTRAINTS).catch(() => {
                c.audioControls?.unmuteAudio?.()
            })
        }
        setIsMicOpen(true)
    }, [getMicPublication])

    const stopRecord = useCallback(() => {
        const c = clientRef.current
        const lp = c?.room?.localParticipant
        const pub = getMicPublication(lp)

        if (pub) {
            // Soft-mute: keeps the WebRTC stream alive but sends silence.
            // The server's VAD sees the silence, fires user-stopped-speaking,
            // and commits the audio buffer to STT — which triggers the reply.
            // Calling disableAudio() / setMicrophoneEnabled(false) instead would
            // UNPUBLISH the track, causing the server to lose the audio source
            // mid-sentence and never fire user-stopped-speaking.
            pub.track.mute()
        } else {
            c?.audioControls?.muteAudio?.()
        }
        setIsMicOpen(false)
    }, [getMicPublication])

    return {
        client,
        state: client.state,
        audioControls: client.audioControls,
        room: client.room ?? null,
        isMicOpen,
        connect: () => client.connect(),
        disconnect: () => client.disconnect(),
        mute: () => client.audioControls?.muteAudio?.(),
        unmute: () => client.audioControls?.unmuteAudio?.(),
        startRecord,
        stopRecord,
        sendUserTextMessage: (text) => client.sendUserTextMessage?.(text),
        updateDynamicInfo: (payload) => client.updateDynamicInfo?.(payload),
        updateTemplateKeys: (templateKeys) => client.updateTemplateKeys?.(templateKeys),
        interrupt: () => client.sendInterruptMessage?.(),
        ...captionState,
        agentDisplayName: AGENT_DISPLAY_NAME,
    }
}
