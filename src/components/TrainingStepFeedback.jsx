import { useEffect, useRef, useState } from 'react'
import { getStepById, useTrainingStore } from '../store/useTrainingStore'

const TOAST_MS = 2600

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
            title: isTrainingComplete ? 'Session Complete' : 'Step Complete',
            subtitle: completedStep?.instruction ?? 'Step completed',
            detail: isTrainingComplete
                ? 'You completed the guided inhaler sequence.'
                : nextStep
                    ? `Next: ${nextStep.instruction}`
                    : 'Prepare for the next action.',
        }

        frameRef.current = window.requestAnimationFrame(() => {
            setToast(nextToast)
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
    }, [currentStepId, isTrainingComplete, lastStepCompletion])

    if (trainingMode === 'assessment') {
        return null
    }

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
                top: 18,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 20,
                minWidth: 320,
                maxWidth: 460,
                padding: '12px 16px',
                borderRadius: 16,
                background: 'rgba(10, 20, 28, 0.86)',
                border: '1px solid rgba(84, 165, 196, 0.25)',
                color: '#f8fafc',
                boxShadow: '0 18px 40px rgba(0, 0, 0, 0.18)',
                backdropFilter: 'blur(8px)',
                pointerEvents: 'none',
                userSelect: 'none',
            }}
        >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>{toast.title}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{toast.subtitle}</div>
            <div style={{ fontSize: 12, color: '#c8d6e3', lineHeight: 1.4 }}>{toast.detail}</div>
        </div>
    )
}
