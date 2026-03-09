import { useEffect, useRef } from 'react'
import { useConvaiRuntime } from '../convai/useConvaiRuntime'
import { getStepById, useTrainingStore } from '../store/useTrainingStore'

function buildDynamicInfo({ currentStepId, sessionPhase, stepProgress, liveHint, secondDoseChoice }) {
    const step = getStepById(currentStepId)

    return {
        text: [
            'You are coaching a user through inhaler training.',
            `Session phase: ${sessionPhase}.`,
            `Current step id: ${currentStepId ?? 'none'}.`,
            `Current step instruction: ${step?.instruction ?? 'No active step'}.`,
            `Current validator: ${step?.validatorType ?? 'none'}.`,
            `Step progress: ${Math.round((stepProgress ?? 0) * 100)}%.`,
            `Live training hint: ${liveHint ?? 'None'}.`,
            `Second dose choice: ${secondDoseChoice == null ? 'undecided' : secondDoseChoice ? 'yes' : 'no'}.`,
        ].join(' '),
    }
}

function buildCoachMessage(message, step) {
    if (!message) {
        return null
    }

    if (message.kind === 'completion') {
        return 'The user completed the inhaler session. Congratulate them briefly, reinforce the key habits, and invite final questions.'
    }

    if (message.kind === 'feedback') {
        return [
            'The user needs corrective coaching on the current inhaler step.',
            `Current step: ${step?.instruction ?? message.stepId}.`,
            `Tell the user this correction in a calm pharmacist tone: "${message.prompt}".`,
            'Keep it brief, specific, and action-oriented.',
        ].join(' ')
    }

    return [
        'The user is ready for the next inhaler training instruction.',
        `Current step: ${step?.instruction ?? message.stepId}.`,
        `Tell the user this instruction in a pharmacist coaching tone: "${message.prompt}".`,
        'Keep it concise and focused on the immediate action only.',
    ].join(' ')
}

function formatConvaiError(error) {
    if (error instanceof Error && error.message) {
        return error.message
    }

    if (typeof error === 'string' && error.trim()) {
        return error
    }

    return 'Unable to connect to the pharmacist right now.'
}

export function ConvaiTrainingOrchestrator() {
    const {
        enabled,
        isConfigured,
        client,
        state,
        connect,
        sendUserTextMessage,
        updateDynamicInfo,
        interrupt,
    } = useConvaiRuntime()

    const {
        sessionPhase,
        currentStepId,
        stepProgress,
        liveHint,
        secondDoseChoice,
        pendingCoachMessage,
        lastDeliveredCoachKey,
        markTrainingActive,
        acknowledgeCoachMessage,
        setSessionError,
        clearSessionError,
    } = useTrainingStore()

    const connectRequestedRef = useRef(false)
    const isBotReadyRef = useRef(false)

    useEffect(() => {
        if (!client) {
            return undefined
        }

        const unsubscribeBotReady = client.on('botReady', () => {
            isBotReadyRef.current = true
            const trainingState = useTrainingStore.getState()
            if (trainingState.sessionPhase === 'starting') {
                trainingState.clearSessionError()
                trainingState.markTrainingActive()
            }
        })

        const unsubscribeDisconnect = client.on('disconnect', () => {
            isBotReadyRef.current = false
            connectRequestedRef.current = false
        })

        const unsubscribeError = client.on('error', (error) => {
            const trainingState = useTrainingStore.getState()
            if (trainingState.sessionPhase === 'starting') {
                trainingState.setSessionError(formatConvaiError(error))
            }
        })

        return () => {
            unsubscribeBotReady?.()
            unsubscribeDisconnect?.()
            unsubscribeError?.()
        }
    }, [client])

    useEffect(() => {
        if (sessionPhase === 'idle') {
            connectRequestedRef.current = false
            clearSessionError()
            return
        }

        if (sessionPhase !== 'starting') {
            return
        }

        if (!enabled || !isConfigured) {
            setSessionError('Guided training is unavailable until Convai is enabled and configured.')
            return
        }

        if (state?.isConnected && (client?.isBotReady || isBotReadyRef.current)) {
            clearSessionError()
            markTrainingActive()
            return
        }

        if (connectRequestedRef.current) {
            return
        }

        connectRequestedRef.current = true
        clearSessionError()
        connect().catch((error) => {
            connectRequestedRef.current = false
            setSessionError(formatConvaiError(error))
        })
    }, [clearSessionError, client, connect, enabled, isConfigured, markTrainingActive, sessionPhase, setSessionError, state?.isConnected])

    useEffect(() => {
        if (!enabled || !isConfigured || !state?.isConnected || !(client?.isBotReady || isBotReadyRef.current)) {
            return
        }

        updateDynamicInfo(
            buildDynamicInfo({
                currentStepId,
                sessionPhase,
                stepProgress,
                liveHint,
                secondDoseChoice,
            }),
        )
    }, [client, currentStepId, enabled, isConfigured, liveHint, secondDoseChoice, sessionPhase, state?.isConnected, stepProgress, updateDynamicInfo])

    useEffect(() => {
        if (!pendingCoachMessage) {
            return
        }

        if (!enabled || !isConfigured) {
            return
        }

        if (!state?.isConnected || !(client?.isBotReady || isBotReadyRef.current)) {
            return
        }

        if (pendingCoachMessage.key === lastDeliveredCoachKey) {
            acknowledgeCoachMessage(pendingCoachMessage.key)
            return
        }

        const step = getStepById(pendingCoachMessage.stepId ?? currentStepId)
        const coachMessage = buildCoachMessage(pendingCoachMessage, step)
        if (!coachMessage) {
            acknowledgeCoachMessage(pendingCoachMessage.key)
            return
        }

        if (state?.isSpeaking || state?.isThinking) {
            interrupt()
        }

        sendUserTextMessage(coachMessage)
        acknowledgeCoachMessage(pendingCoachMessage.key)
    }, [
        acknowledgeCoachMessage,
        client,
        currentStepId,
        enabled,
        interrupt,
        isConfigured,
        lastDeliveredCoachKey,
        pendingCoachMessage,
        sendUserTextMessage,
        state?.isConnected,
        state?.isSpeaking,
        state?.isThinking,
    ])

    return null
}
