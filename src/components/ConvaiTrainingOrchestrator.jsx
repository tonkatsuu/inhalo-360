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
        return 'The training session is complete. Congratulate the user briefly and invite final questions.'
    }

    if (message.kind === 'feedback') {
        return [
            'Guidance required:',
            `"${message.prompt}"`,
            'Deliver this instruction briefly and calmly.'
        ].join(' ')
    }

    return [
        'Next instruction:',
        `"${message.prompt}"`,
        'State this instruction accurately and concisely.'
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
        trainingMode,
    } = useTrainingStore()
    
    useEffect(() => {
        console.log('[ConvaiOrchestrator] state updated:', state)
    }, [state])

    const connectRequestedRef = useRef(false)
    const isBotReadyRef = useRef(false)

    useEffect(() => {
        if (!client) {
            return undefined
        }

        const unsubscribeBotReady = client.on('botReady', () => {
            console.log('[ConvaiOrchestrator] botReady event fired')
            isBotReadyRef.current = true
            const trainingState = useTrainingStore.getState()
            if (trainingState.sessionPhase === 'starting') {
                trainingState.clearSessionError()
                trainingState.markTrainingActive()
            }
        })

        const unsubscribeDisconnect = client.on('disconnect', () => {
            console.log('[ConvaiOrchestrator] disconnect event fired')
            isBotReadyRef.current = false
            connectRequestedRef.current = false
        })

        const unsubscribeError = client.on('error', (error) => {
            console.error('[ConvaiOrchestrator] client error event', error)
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

        if (trainingMode === 'assessment') {
            return
        }

        if (sessionPhase !== 'starting') {
            return
        }

        if (!enabled || !isConfigured) {
            setSessionError('Guided training is unavailable until Convai is enabled and configured.')
            return
        }

        // We use state?.isConnected instead of waiting for isBotReady because 
        // the botReady data channel event can sometimes be dropped by LiveKit
        if (state?.isConnected) {
            clearSessionError()
            markTrainingActive()
            return
        }

        if (connectRequestedRef.current) {
            return
        }

        connectRequestedRef.current = true
        clearSessionError()
        console.log('[ConvaiOrchestrator] calling connect()…', { enabled, isConfigured, isConnected: state?.isConnected })
        
        let timeoutId;
        const connectPromise = connect()
            .then(() => { 
                console.log('[ConvaiOrchestrator] connect() resolved', { isConnected: state?.isConnected, isBotReady: client?.isBotReady })
                
                // Add a fallback timeout in case botReady never fires (e.g. invalid character ID)
                timeoutId = window.setTimeout(() => {
                    const currentState = useTrainingStore.getState()
                    if (currentState.sessionPhase === 'starting') {
                        console.error('[ConvaiOrchestrator] Connection timeout. botReady event was not received.')
                        connectRequestedRef.current = false
                        currentState.setSessionError('Connection timeout. Please verify your Character ID and API Key, and ensure your dev server is restarted if you recently updated your .env file.')
                    }
                }, 15000)
            })
            .catch((error) => {
                console.error('[ConvaiOrchestrator] connect() rejected', error)
                connectRequestedRef.current = false
                setSessionError(formatConvaiError(error))
            })

        return () => {
            if (timeoutId) {
                window.clearTimeout(timeoutId)
            }
        }
    }, [clearSessionError, client, connect, enabled, isConfigured, markTrainingActive, sessionPhase, setSessionError, state?.isConnected])

    useEffect(() => {
        if (trainingMode === 'assessment' || !enabled || !isConfigured || !state?.isConnected) {
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
        if (trainingMode === 'assessment' || !pendingCoachMessage) {
            return
        }

        if (!enabled || !isConfigured || !state?.isConnected) {
            return
        }

        if (pendingCoachMessage.key === lastDeliveredCoachKey) {
            acknowledgeCoachMessage(pendingCoachMessage.key)
            return
        }

        // If the AI is currently active, interrupt the active stream and WAIT.
        // The effect will re-run once state.isSpeaking/isThinking resolve to false.
        if (state?.isSpeaking || state?.isThinking) {
            interrupt()
            return
        }

        // Wait a brief moment to debounce rapid step skipping.
        // If the user advances quickly, this timeout clears and only the latest step prompt is sent.
        const timeoutId = window.setTimeout(() => {
            const step = getStepById(pendingCoachMessage.stepId ?? currentStepId)
            const coachMessage = buildCoachMessage(pendingCoachMessage, step)
            
            if (coachMessage) {
                sendUserTextMessage(coachMessage)
            }
            
            acknowledgeCoachMessage(pendingCoachMessage.key)
        }, 400)

        // Cleanup: cancels the timeout if the user skips again, dropping the stale message.
        return () => {
            window.clearTimeout(timeoutId)
        }
    }, [
        acknowledgeCoachMessage,
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
        trainingMode,
    ])

    return null
}
