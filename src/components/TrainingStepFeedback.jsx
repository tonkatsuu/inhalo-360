import { useEffect, useRef, useState } from 'react'
import { TRAINING_STEPS, useTrainingStore } from '../store/useTrainingStore'

const TOAST_MS = 2600

export function TrainingStepFeedback() {
    const { completedSteps, currentStep, isTrainingComplete, sessionPhase } = useTrainingStore()
    const [toast, setToast] = useState(null)
    const prevCompletedCount = useRef(completedSteps.length)
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

        if (sessionPhase === 'idle' || sessionPhase === 'starting') {
            prevCompletedCount.current = completedSteps.length
            return undefined
        }

        if (completedSteps.length > prevCompletedCount.current) {
            const completedStepId = completedSteps[completedSteps.length - 1]
            const completedStep = TRAINING_STEPS.find((step) => step.id === completedStepId)
            const nextStep = TRAINING_STEPS.find((step) => step.id === currentStep)
            const nextToast = {
                title: isTrainingComplete ? 'Session Complete' : 'Step Complete',
                subtitle: completedStep?.text ?? 'Step completed',
                detail: isTrainingComplete
                    ? `${completedSteps.length}/${TRAINING_STEPS.length} steps complete`
                    : nextStep
                        ? `Next: ${nextStep.text}`
                        : `${completedSteps.length}/${TRAINING_STEPS.length} steps complete`,
            }

            frameRef.current = window.requestAnimationFrame(() => {
                setToast(nextToast)
                timeoutRef.current = window.setTimeout(() => {
                    setToast(null)
                }, TOAST_MS)
            })
        }

        prevCompletedCount.current = completedSteps.length

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
    }, [completedSteps, currentStep, isTrainingComplete, sessionPhase])

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
                minWidth: 280,
                maxWidth: 420,
                padding: '12px 16px',
                borderRadius: 14,
                background: 'rgba(10, 20, 28, 0.86)',
                border: '1px solid rgba(84, 165, 196, 0.25)',
                color: '#f8fafc',
                boxShadow: '0 18px 40px rgba(0, 0, 0, 0.18)',
                backdropFilter: 'blur(8px)',
                pointerEvents: 'none',
                userSelect: 'none',
                fontFamily: 'system-ui, sans-serif',
            }}
        >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>{toast.title}</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{toast.subtitle}</div>
            <div style={{ fontSize: 12, color: '#c8d6e3', lineHeight: 1.4 }}>{toast.detail}</div>
        </div>
    )
}
