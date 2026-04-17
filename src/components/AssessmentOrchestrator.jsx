import { useEffect, useRef } from 'react'
import { useTrainingStore } from '../store/useTrainingStore'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { matchStepSpeech } from '../training/assessment'

export function AssessmentOrchestrator() {
    const {
        assessmentRequireSpeech,
        trainingMode,
        currentStepId,
        sessionPhase,
        markAssessmentSpeech,
        setAssessmentListening,
        setAssessmentSpeechLevel,
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
        inputLevel,
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
        setAssessmentSpeechStatus(trainingMode === 'assessment' && assessmentRequireSpeech ? status : 'idle')
    }, [assessmentRequireSpeech, setAssessmentSpeechStatus, status, trainingMode])

    useEffect(() => {
        setAssessmentSpeechError(trainingMode === 'assessment' && assessmentRequireSpeech ? error : null)
    }, [assessmentRequireSpeech, error, setAssessmentSpeechError, trainingMode])

    useEffect(() => {
        setAssessmentSpeechLevel(trainingMode === 'assessment' && assessmentRequireSpeech ? inputLevel : 0)
    }, [assessmentRequireSpeech, inputLevel, setAssessmentSpeechLevel, trainingMode])

    useEffect(() => {
        setAssessmentListening(trainingMode === 'assessment' && assessmentRequireSpeech && isListening)
    }, [assessmentRequireSpeech, isListening, setAssessmentListening, trainingMode])

    useEffect(() => {
        if (trainingMode !== 'assessment' || !assessmentRequireSpeech) {
            setAssessmentTranscript('')
            return
        }

        setAssessmentTranscript(transcript)
    }, [assessmentRequireSpeech, transcript, trainingMode, setAssessmentTranscript])

    // Manage listening state
    useEffect(() => {
        if (trainingMode === 'assessment' && assessmentRequireSpeech && sessionPhase !== 'completed' && sessionPhase !== 'idle') {
            if (!isListening && isSupported) {
                startListening()
            }
        } else {
            if (isListening) {
                stopListening()
            }
        }
    }, [assessmentRequireSpeech, trainingMode, sessionPhase, isListening, startListening, stopListening, isSupported])

    useEffect(() => {
        if (trainingMode !== 'assessment' || sessionPhase === 'completed' || sessionPhase === 'idle') {
            clearSessionError()
            return
        }

        if (!assessmentRequireSpeech) {
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
    }, [assessmentRequireSpeech, trainingMode, sessionPhase, isSupported, error, setSessionError, clearSessionError])

    useEffect(() => {
        if (trainingMode !== 'assessment' || !assessmentRequireSpeech || !currentStepId || sessionPhase === 'completed' || sessionPhase === 'idle' || !isSupported) {
            previousStepIdRef.current = currentStepId
            return
        }

        if (previousStepIdRef.current && previousStepIdRef.current !== currentStepId) {
            restartListening()
        }

        previousStepIdRef.current = currentStepId
    }, [assessmentRequireSpeech, currentStepId, isSupported, restartListening, sessionPhase, trainingMode])

    // Detect speech confirmation for the current step and let the store decide whether it can advance.
    useEffect(() => {
        if (trainingMode !== 'assessment' || !assessmentRequireSpeech || !currentStepId || sessionPhase === 'completed') return

        if (matchStepSpeech(transcript, currentStepId)) {
            markAssessmentSpeech(currentStepId, transcript)
        }
    }, [assessmentRequireSpeech, transcript, currentStepId, trainingMode, sessionPhase, markAssessmentSpeech])

    return null
}
