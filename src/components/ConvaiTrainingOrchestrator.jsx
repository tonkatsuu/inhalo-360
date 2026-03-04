import { useEffect, useMemo, useRef } from 'react'
import { useConvaiRuntime } from '../convai/useConvaiRuntime'
import { TRAINING_STEPS, useTrainingStore } from '../store/useTrainingStore'

function buildDynamicInfo({ currentStep, sessionPhase, isTrainingComplete }) {
    const step = TRAINING_STEPS[currentStep]
    const visibleStepText = step?.text ?? 'No active step'

    return {
        text: [
            'You are coaching a user through inhaler training.',
            `Session phase: ${sessionPhase}.`,
            `Visible checklist step id: ${currentStep}.`,
            `Visible checklist step text: ${visibleStepText}.`,
            `Optional second dose step: ${step?.optional === true ? 'yes' : 'no'}.`,
            `Training complete: ${isTrainingComplete ? 'yes' : 'no'}.`,
        ].join(' '),
    }
}

function buildInitialNarrationMessage(step) {
    return [
        'We are starting inhaler training.',
        'First, give a short preparation instruction: "Pick up the inhaler."',
        `Then guide the user through the current visible checklist step only. The current visible step is step ${step.id}: "${step.text}".`,
        'Keep the instruction concise and spoken as a pharmacist coach.',
    ].join(' ')
}

function buildStepNarrationMessage(step) {
    return [
        'The user has reached a new inhaler training step.',
        `Speak only the instruction for the current visible checklist step. Current step: ${step.id}.`,
        `Step text: "${step.text}".`,
        'Keep it concise, coaching-focused, and relevant to the action the user should do now.',
    ].join(' ')
}

const COMPLETION_MESSAGE =
    'The user has completed the inhaler training checklist. Give a short completion message, then invite them to ask any final questions.'

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
        currentStep,
        isTrainingComplete,
        lastSpokenStepKey,
        markTrainingActive,
        markStepNarrated,
        setSessionError,
        clearSessionError,
    } = useTrainingStore()

    const connectRequestedRef = useRef(false)
    const isBotReadyRef = useRef(false)

    const currentStepData = TRAINING_STEPS[currentStep]
    const currentStepKey = useMemo(() => `step-${currentStep}`, [currentStep])

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
        if (sessionPhase !== 'active' || !enabled || !isConfigured || !currentStepData) {
            return
        }

        if (!state?.isConnected || !(client?.isBotReady || isBotReadyRef.current)) {
            return
        }

        updateDynamicInfo(buildDynamicInfo({ currentStep, sessionPhase, isTrainingComplete }))

        if (lastSpokenStepKey === currentStepKey) {
            return
        }

        if (state?.isSpeaking || state?.isThinking) {
            interrupt()
        }

        if (currentStep === 0 && lastSpokenStepKey === null) {
            sendUserTextMessage(buildInitialNarrationMessage(currentStepData))
        } else {
            sendUserTextMessage(buildStepNarrationMessage(currentStepData))
        }

        markStepNarrated(currentStepKey)
    }, [
        client,
        currentStep,
        currentStepData,
        currentStepKey,
        enabled,
        interrupt,
        isConfigured,
        isTrainingComplete,
        lastSpokenStepKey,
        markStepNarrated,
        sendUserTextMessage,
        sessionPhase,
        state?.isConnected,
        state?.isSpeaking,
        state?.isThinking,
        updateDynamicInfo,
    ])

    useEffect(() => {
        if (sessionPhase !== 'completed' || !enabled || !isConfigured) {
            return
        }

        if (!state?.isConnected || !(client?.isBotReady || isBotReadyRef.current)) {
            return
        }

        if (lastSpokenStepKey === 'completed') {
            return
        }

        updateDynamicInfo(buildDynamicInfo({ currentStep, sessionPhase, isTrainingComplete: true }))

        if (state?.isSpeaking || state?.isThinking) {
            interrupt()
        }

        sendUserTextMessage(COMPLETION_MESSAGE)
        markStepNarrated('completed')
    }, [
        client,
        currentStep,
        enabled,
        interrupt,
        isConfigured,
        lastSpokenStepKey,
        markStepNarrated,
        sendUserTextMessage,
        sessionPhase,
        state?.isConnected,
        state?.isSpeaking,
        state?.isThinking,
        updateDynamicInfo,
    ])

    return null
}
