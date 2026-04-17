import { useEffect, useRef, useState } from 'react'
import { getStepById, useTrainingStore } from '../store/useTrainingStore'

const TOAST_MS = 2600
let sharedAudioContext = null

function playStepPassedTone() {
    if (typeof window === 'undefined') {
        return
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) {
        return
    }

    try {
        if (!sharedAudioContext) {
            sharedAudioContext = new AudioCtx()
        }

        if (sharedAudioContext.state === 'suspended') {
            sharedAudioContext.resume().catch(() => {})
        }

        const now = sharedAudioContext.currentTime
        const gainNode = sharedAudioContext.createGain()
        const oscillatorA = sharedAudioContext.createOscillator()
        const oscillatorB = sharedAudioContext.createOscillator()

        oscillatorA.type = 'sine'
        oscillatorA.frequency.setValueAtTime(784, now)
        oscillatorB.type = 'sine'
        oscillatorB.frequency.setValueAtTime(1046, now + 0.08)

        gainNode.gain.setValueAtTime(0.0001, now)
        gainNode.gain.exponentialRampToValueAtTime(0.02, now + 0.02)
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)

        oscillatorA.connect(gainNode)
        oscillatorB.connect(gainNode)
        gainNode.connect(sharedAudioContext.destination)

        oscillatorA.start(now)
        oscillatorA.stop(now + 0.16)
        oscillatorB.start(now + 0.05)
        oscillatorB.stop(now + 0.22)
    } catch {
        // Silent fallback if audio playback is blocked.
    }
}

export function TrainingStepFeedback() {
    const { currentStepId, isTrainingComplete, lastStepCompletion, sessionPhase, trainingMode } = useTrainingStore()
    const [toast, setToast] = useState(null)
    
    const prevCompletionRef = useRef(lastStepCompletion?.completedAt ?? null)
    const timeoutRef = useRef(null)
    const frameRef = useRef(null)

    useEffect(() => {
        if (frameRef.current) {
            window.cancelAnimationFrame(frameRef.current)
            frameRef.current = null
        }

        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current)
            timeoutRef.current = null
        }

        if (!lastStepCompletion || lastStepCompletion.completedAt === prevCompletionRef.current) {
            return undefined
        }

        const completedStep = getStepById(lastStepCompletion.stepId)
        const nextStep = getStepById(currentStepId)
        const nextToast = {
            title: isTrainingComplete ? 'Session Complete' : trainingMode === 'assessment' ? 'Step Passed' : 'Step Complete',
            subtitle: completedStep?.instruction ?? 'Step completed',
            detail: isTrainingComplete
                ? trainingMode === 'assessment'
                    ? 'Assessment finished. Review the results when ready.'
                    : 'You completed the guided inhaler sequence.'
                : trainingMode === 'assessment'
                    ? nextStep
                        ? `Narration accepted. Continue with: ${nextStep.shortLabel ?? nextStep.instruction}`
                        : 'Narration accepted. Continue when ready.'
                    : nextStep
                        ? `Next: ${nextStep.instruction}`
                        : 'Prepare for the next action.',
        }

        frameRef.current = window.requestAnimationFrame(() => {
            setToast(nextToast)
            playStepPassedTone()
            timeoutRef.current = window.setTimeout(() => {
                setToast(null)
            }, TOAST_MS)
        })

        prevCompletionRef.current = lastStepCompletion.completedAt

        return () => {
            if (frameRef.current) {
                window.cancelAnimationFrame(frameRef.current)
                frameRef.current = null
            }
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current)
                timeoutRef.current = null
            }
        }
    }, [currentStepId, isTrainingComplete, lastStepCompletion, trainingMode])

    if (!toast) {
        return null
    }

    if (sessionPhase === 'idle' || sessionPhase === 'starting') {
        return null
    }

    return (
        <div
            style={{
                position: 'absolute',
                top: trainingMode === 'assessment' ? 22 : 18,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 20,
                minWidth: trainingMode === 'assessment' ? 260 : 320,
                maxWidth: trainingMode === 'assessment' ? 380 : 460,
                padding: trainingMode === 'assessment' ? '10px 14px' : '12px 16px',
                borderRadius: 16,
                background: trainingMode === 'assessment' ? 'rgba(14, 34, 26, 0.84)' : 'rgba(10, 20, 28, 0.86)',
                border: trainingMode === 'assessment'
                    ? '1px solid rgba(74, 222, 128, 0.22)'
                    : '1px solid rgba(84, 165, 196, 0.25)',
                color: '#f8fafc',
                boxShadow: '0 18px 40px rgba(0, 0, 0, 0.18)',
                backdropFilter: 'blur(8px)',
                pointerEvents: 'none',
                userSelect: 'none',
            }}
        >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>{toast.title}</div>
            <div style={{ fontSize: trainingMode === 'assessment' ? 14 : 15, fontWeight: 700, marginBottom: 4 }}>{toast.subtitle}</div>
            <div style={{ fontSize: 12, color: '#c8d6e3', lineHeight: 1.4 }}>{toast.detail}</div>
        </div>
    )
}
