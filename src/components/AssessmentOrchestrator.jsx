import { useEffect, useRef } from 'react'
import { useTrainingStore } from '../store/useTrainingStore'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { matchStepSpeech } from '../training/assessment'

export function AssessmentOrchestrator() {
    const {
        trainingMode,
        currentStepId,
        sessionPhase,
        markAssessmentSpeech,
        setAssessmentListening,
        setAssessmentSpeechStatus,
        setAssessmentSpeechError,
        setAssessmentSpeechSupported,
        setAssessmentTranscript,
        setSessionError,
        clearSessionError,
    } = useTrainingStore()

    const { 
        isListening, 
        status,
        transcript, 
        error,
        startListening, 
        stopListening, 
        restartListening,
        isSupported 
    } = useSpeechRecognition()
    const previousStepIdRef = useRef(null)

    useEffect(() => {
        setAssessmentSpeechSupported(isSupported)
    }, [isSupported, setAssessmentSpeechSupported])

    useEffect(() => {
        setAssessmentSpeechStatus(trainingMode === 'assessment' ? status : 'idle')
    }, [setAssessmentSpeechStatus, status, trainingMode])

    useEffect(() => {
        setAssessmentSpeechError(error)
    }, [error, setAssessmentSpeechError])

    useEffect(() => {
        setAssessmentListening(trainingMode === 'assessment' && isListening)
    }, [isListening, setAssessmentListening, trainingMode])

    useEffect(() => {
        if (trainingMode !== 'assessment') {
            setAssessmentTranscript('')
            return
        }

        setAssessmentTranscript(transcript)
    }, [transcript, trainingMode, setAssessmentTranscript])

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

    useEffect(() => {
        if (trainingMode !== 'assessment' || sessionPhase === 'completed' || sessionPhase === 'idle') {
            clearSessionError()
            return
        }

        if (!isSupported) {
            setSessionError('Assessment mode requires speech recognition so the learner can narrate each step aloud.')
            return
        }

        if (error === 'not-allowed' || error === 'service-not-allowed') {
            setSessionError('Assessment uses hot mic. Please allow microphone access in the browser so narration can be transcribed.')
            return
        }

        if (error === 'audio-capture') {
            setSessionError('Assessment uses hot mic, but no microphone input was detected. Check your active microphone and browser permissions.')
            return
        }

        if (error === 'start_failed' || error === 'restart_failed' || error === 'InvalidStateError') {
            setSessionError('Assessment hot mic could not start. Click once in the scene and allow microphone access, then try speaking again.')
            return
        }

        if (error && error !== 'no-speech') {
            setSessionError(`Assessment hot mic is unavailable right now (${error}).`)
            return
        }

        clearSessionError()
    }, [trainingMode, sessionPhase, isSupported, error, setSessionError, clearSessionError])

    useEffect(() => {
        if (trainingMode !== 'assessment' || !currentStepId || sessionPhase === 'completed' || sessionPhase === 'idle' || !isSupported) {
            previousStepIdRef.current = currentStepId
            return
        }

        if (previousStepIdRef.current && previousStepIdRef.current !== currentStepId) {
            restartListening()
        }

        previousStepIdRef.current = currentStepId
    }, [currentStepId, isSupported, restartListening, sessionPhase, trainingMode])

    // Detect speech confirmation for the current step and let the store decide whether it can advance.
    useEffect(() => {
        if (trainingMode !== 'assessment' || !currentStepId || sessionPhase === 'completed') return

        if (matchStepSpeech(transcript, currentStepId)) {
            markAssessmentSpeech(currentStepId, transcript)
        }
    }, [transcript, currentStepId, trainingMode, sessionPhase, markAssessmentSpeech])

    return null
}
