import React from 'react'
import { useTrainingStore, TRAINING_STEPS } from '../store/useTrainingStore'

export function TrainingHUD() {
    const { currentStep, completedSteps, isTrainingComplete, sessionPhase, sessionError } = useTrainingStore()

    const statusText = sessionError
        ? sessionError
        : sessionPhase === 'idle'
            ? 'Waiting to start training'
            : sessionPhase === 'starting'
                ? 'Connecting to pharmacist...'
                : sessionPhase === 'completed'
                    ? 'Training complete'
                    : null

    return (
        <div
            style={{
                position: 'absolute',
                top: 20,
                left: 20,
                zIndex: 10,
                background: 'rgba(0, 0, 0, 0.7)',
                borderRadius: '10px',
                padding: '14px 16px',
                color: '#fff',
                fontSize: 12,
                fontFamily: 'sans-serif',
                width: 260,
                pointerEvents: 'none',
                userSelect: 'none',
                backdropFilter: 'blur(6px)',
            }}
        >
            <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 10, color: '#ffd46b' }}>
                Inhaler Training
            </div>
            {statusText && (
                <div
                    style={{
                        marginBottom: 10,
                        padding: '6px 8px',
                        borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: sessionError ? '#fca5a5' : '#cbd5e1',
                        lineHeight: 1.4,
                    }}
                >
                    {statusText}
                </div>
            )}
            {TRAINING_STEPS.map((step) => {
                const isCompleted = completedSteps.includes(step.id)
                const isCurrent = currentStep === step.id
                return (
                    <div
                        key={step.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '3px 0',
                            opacity: isCompleted ? 0.5 : 1,
                        }}
                    >
                        <div
                            style={{
                                width: 14,
                                height: 14,
                                borderRadius: 3,
                                border: '2px solid',
                                borderColor: isCompleted ? '#4ade80' : isCurrent ? '#fbbf24' : '#555',
                                backgroundColor: isCompleted ? '#4ade80' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            {isCompleted && (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            )}
                        </div>
                        <span
                            style={{
                                color: isCurrent ? '#fbbf24' : '#ccc',
                                textDecoration: isCompleted ? 'line-through' : 'none',
                                lineHeight: 1.3,
                            }}
                        >
                            {step.text}
                        </span>
                    </div>
                )
            })}
            {isTrainingComplete && (
                <div
                    style={{
                        marginTop: 10,
                        padding: 6,
                        background: '#d1fae5',
                        color: '#065f46',
                        borderRadius: 6,
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontSize: 13,
                    }}
                >
                    ✓ Training Complete!
                </div>
            )}
        </div>
    )
}
