import { useEffect, useRef } from 'react'
import { useTrainingStore, getStepById } from '../store/useTrainingStore'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { matchStepSpeech } from '../training/assessment'

export function AssessmentOrchestrator() {
    const {
        trainingMode,
        currentStepId,
        sessionPhase,
        lastStepCompletion,
        recordAssessmentStep
    } = useTrainingStore()

    const { 
        isListening, 
        transcript, 
        startListening, 
        stopListening, 
        isSupported 
    } = useSpeechRecognition()

    const speechConfirmedByStepRef = useRef({})

    // Manage listening state
    useEffect(() => {
        if (trainingMode === 'assessment' && sessionPhase !== 'completed' && sessionPhase !== 'idle') {
            if (!isListening && isSupported) {
                startListening()
            }
        } else {
            if (isListening) {
                stopListening()
            }
        }
    }, [trainingMode, sessionPhase, isListening, startListening, stopListening, isSupported])

    // Detect speech confirmation for the current step - persist by stepId so recording can use it
    useEffect(() => {
        if (trainingMode !== 'assessment' || !currentStepId || sessionPhase === 'completed') return

        if (matchStepSpeech(transcript, currentStepId)) {
            speechConfirmedByStepRef.current[currentStepId] = true
        }
    }, [transcript, currentStepId, trainingMode, sessionPhase])

    // Record results when a step is completed - use stored speech confirmation for that step
    useEffect(() => {
        if (trainingMode !== 'assessment' || !lastStepCompletion) return

        const { stepId } = lastStepCompletion

        const state = useTrainingStore.getState()
        const alreadyRecorded = state.assessmentChecklist.some(item => item.stepId === stepId)

        if (!alreadyRecorded) {
            const speechConfirmed = speechConfirmedByStepRef.current[stepId] ?? false
            recordAssessmentStep(stepId, true, speechConfirmed)
            delete speechConfirmedByStepRef.current[stepId]
        }
    }, [lastStepCompletion, trainingMode, recordAssessmentStep])

    return null
}
