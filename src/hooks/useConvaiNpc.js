import { useCallback, useEffect, useRef, useState } from 'react'
import { useConvaiClient } from '@convai/web-sdk/react'

const CAPTION_LINGER_MS = 3500
const AGENT_DISPLAY_NAME = 'Pharmacist Ava'
const AGENT_MESSAGE_TYPES = new Set(['convai', 'bot-llm-text'])

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
    const lingerTimeoutRef = useRef(null)

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

        return () => {
            unsubscribeMessages?.()
            unsubscribeTurnEnd?.()
            unsubscribeDisconnect?.()
            unsubscribeConnect?.()
            clearCaptionTimer()
        }
    }, [clearCaptionTimer, client, resetCaptionState])

    return {
        client,
        state: client.state,
        audioControls: client.audioControls,
        room: client.room ?? null,
        connect: () => client.connect(),
        disconnect: () => client.disconnect(),
        mute: () => client.audioControls?.muteAudio?.(),
        unmute: () => client.audioControls?.unmuteAudio?.(),
        startRecord: () => client.audioControls?.unmuteAudio?.(),
        stopRecord: () => client.audioControls?.muteAudio?.(),
        sendUserTextMessage: (text) => client.sendUserTextMessage?.(text),
        updateDynamicInfo: (payload) => client.updateDynamicInfo?.(payload),
        updateTemplateKeys: (templateKeys) => client.updateTemplateKeys?.(templateKeys),
        interrupt: () => client.sendInterruptMessage?.(),
        ...captionState,
        agentDisplayName: AGENT_DISPLAY_NAME,
    }
}
