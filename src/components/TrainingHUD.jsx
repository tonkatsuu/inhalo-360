import React from 'react'
import { BrandBadge } from './BrandBadge'
import { getStepById, getVisibleTrainingSteps, useTrainingStore } from '../store/useTrainingStore'
import { isSessionRunning } from '../training/engine'
import { useConvaiRuntime } from '../convai/useConvaiRuntime'

function getStatusText(sessionPhase, sessionError) {
    if (sessionError) {
        return sessionError
    }

    if (sessionPhase === 'idle') {
        return 'Waiting to start training'
    }

    if (sessionPhase === 'starting') {
        return 'Connecting to pharmacist...'
    }

    if (sessionPhase === 'coaching') {
        return 'Ava is guiding the next step'
    }

    if (sessionPhase === 'feedback') {
        return 'Corrective coaching in progress'
    }

    if (sessionPhase === 'branching') {
        return 'Choose whether a second dose is needed'
    }

    if (sessionPhase === 'completed') {
        return 'Training complete'
    }

    return 'Follow the current step'
}

function getControlHints(inputMode, step) {
    if (inputMode === 'xr') {
        return [
            'Quest: point and select the inhaler to grab it.',
            'Thumbstick up = simulate inhale, down = simulate exhale.',
            'Trigger = press inhaler, B = hold breath.',
            'Hold X/Y on Left Controller to Talk to Pharmacist.',
        ]
    }

    if (!step) {
        return []
    }

    return [
        'Desktop: click the inhaler to focus. Right-click puts it down.',
        'Left-click and hold to perform the guided action (breathe out, inhale, or hold breath).',
        'Hold Space to Talk to Pharmacist.',
    ]
}

function getDesktopFlowPreview(steps, currentStepId) {
    const currentIndex = steps.findIndex((step) => step.id === currentStepId)
    if (currentIndex < 0) {
        return steps.slice(0, 4)
    }

    return steps.slice(Math.max(0, currentIndex - 1), Math.min(steps.length, currentIndex + 3))
}

export function TrainingHUD() {
    const {
        currentStepId,
        completedSteps,
        isTrainingComplete,
        inputMode,
        liveHint,
        secondDoseChoice,
        sessionError,
        sessionPhase,
        stepProgress,
        trainingMode,
        finishAssessment,
    } = useTrainingStore()

    const { state: convaiState, isMicOpen } = useConvaiRuntime()
    const isListeningActive = convaiState?.isConnected === true && isMicOpen === true
    
    // In assessment mode, we use Web Speech API recording indicator indirectly
    const isAssessment = trainingMode === 'assessment'

    const currentStep = getStepById(currentStepId)
    const visibleSteps = getVisibleTrainingSteps(secondDoseChoice)
    const statusText = getStatusText(sessionPhase, sessionError)
    const controlHints = getControlHints(inputMode, currentStep)
    const desktopFlowPreview = getDesktopFlowPreview(visibleSteps, currentStepId)
    const showLiveTraining = isSessionRunning(sessionPhase) || sessionPhase === 'completed'
    
    const isDesktop = inputMode !== 'xr'

    return (
        <div
            style={{
                position: 'absolute',
                left: isDesktop ? 24 : undefined,
                right: isDesktop ? undefined : 24,
                bottom: 22,
                zIndex: 10,
                width: isDesktop ? 300 : 350,
                padding: isDesktop ? '14px' : '18px 18px 16px',
                borderRadius: 20,
                background: 'linear-gradient(180deg, rgba(248, 243, 233, 0.94), rgba(240, 233, 221, 0.92))',
                border: '1px solid rgba(115, 139, 151, 0.18)',
                boxShadow: '0 24px 54px rgba(33, 44, 50, 0.18)',
                color: '#16303d',
                backdropFilter: 'blur(14px)',
                userSelect: 'none',
                opacity: (isAssessment && sessionPhase === 'completed') ? 0 : 1, // Hide HUD when results are shown
                transition: 'opacity 0.3s ease',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <BrandBadge compact subtitle={isAssessment ? "Self Assessment" : "Ava coaching"} />
                <div
                    style={{
                        padding: '6px 10px',
                        borderRadius: 999,
                        background: 'rgba(71, 108, 124, 0.08)',
                        color: '#4b6470',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    {isListeningActive && (
                        <div style={{ color: '#22c55e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                            LISTENING
                        </div>
                    )}
                    {isAssessment && (
                        <div style={{ color: '#4b7a8c', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#4b7a8c' }} />
                            LISTENING
                        </div>
                    )}
                    {inputMode === 'xr' ? 'Quest / XR' : 'Desktop'}
                </div>
            </div>

            {!isAssessment && (
                <div
                    style={{
                        marginBottom: isDesktop ? 0 : 12,
                        padding: '10px 12px',
                        borderRadius: 12,
                        background: 'rgba(93, 128, 143, 0.08)',
                        color: sessionError ? '#b84747' : '#506976',
                        lineHeight: 1.45,
                        fontSize: 13,
                        fontWeight: 400,
                    }}
                >
                    {statusText}
                </div>
            )}

            {isAssessment && !isTrainingComplete && (
                <button
                    onClick={finishAssessment}
                    style={{
                        width: '100%',
                        marginTop: 10,
                        padding: '8px',
                        borderRadius: 10,
                        border: '1px solid rgba(185, 28, 28, 0.2)',
                        background: 'rgba(185, 28, 28, 0.08)',
                        color: '#b91c1c',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer'
                    }}
                >
                    End Assessment Early
                </button>
            )}

            {showLiveTraining && currentStep && !isAssessment && (
                <div
                    style={{
                        marginTop: isDesktop ? 12 : 0,
                        marginBottom: isDesktop ? 0 : 14,
                        padding: '12px 13px',
                        borderRadius: 14,
                        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(243, 236, 224, 0.82))',
                        border: '1px solid rgba(112, 139, 153, 0.18)',
                    }}
                >
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c8595', marginBottom: 8 }}>
                        Current Action
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.25, marginBottom: 8 }}>{currentStep.instruction}</div>
                    <div style={{ fontSize: 13, color: '#415967', lineHeight: 1.45 }}>{liveHint}</div>
                    <div
                        style={{
                            marginTop: 10,
                            height: 8,
                            borderRadius: 999,
                            background: 'rgba(77, 106, 118, 0.1)',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                height: '100%',
                                width: `${Math.round((stepProgress ?? 0) * 100)}%`,
                                background: 'linear-gradient(90deg, #2b9348, #4b7a8c)',
                                borderRadius: 999,
                                transition: 'width 140ms linear',
                            }}
                        />
                    </div>
                </div>
            )}

            {!isDesktop && !isAssessment && (
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c8595', marginBottom: 8 }}>
                        Controls
                    </div>
                    {controlHints.map((hint) => (
                        <div key={hint} style={{ fontSize: 12, lineHeight: 1.45, color: '#546d7a', marginBottom: 4 }}>
                            {hint}
                        </div>
                    ))}
                </div>
            )}

            {showLiveTraining && !isAssessment ? (
                <>
                    {!isDesktop && (
                        <>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5c8595', marginBottom: 8 }}>
                                Flow Preview
                            </div>
                            {desktopFlowPreview.map((step) => {
                                const isCompleted = completedSteps.includes(step.id)
                                const isCurrent = currentStepId === step.id
                                return (
                                    <div
                                        key={step.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 8,
                                            padding: '4px 0',
                                            opacity: isCompleted ? 0.48 : 1,
                                        }}
                                    >
                                        <div
                                            style={{
                                                marginTop: 2,
                                                width: 14,
                                                height: 14,
                                                borderRadius: 999,
                                                border: '2px solid',
                                                borderColor: isCompleted ? '#2b9348' : isCurrent ? '#4b7a8c' : '#95a8b1',
                                                background: isCompleted ? '#2b9348' : isCurrent ? 'rgba(75, 122, 140, 0.16)' : 'transparent',
                                                flexShrink: 0,
                                            }}
                                        />
                                        <div style={{ color: isCurrent ? '#16303d' : '#5a6f79', lineHeight: 1.35, textDecoration: isCompleted ? 'line-through' : 'none' }}>
                                            {step.instruction}
                                        </div>
                                    </div>
                                )
                            })}

                            {visibleSteps.length > desktopFlowPreview.length && (
                                <div style={{ marginTop: 6, fontSize: 12, color: '#6f8792' }}>
                                    Full step list stays on the in-world clipboard.
                                </div>
                            )}
                        </>
                    )}
                </>
            ) : (
                !isDesktop && (
                    <div
                        style={{
                            padding: '12px 13px',
                            borderRadius: 14,
                            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(243, 236, 224, 0.82))',
                            border: '1px solid rgba(112, 139, 153, 0.18)',
                            color: '#4c6470',
                            lineHeight: 1.5,
                            fontSize: 13,
                        }}
                    >
                        Start the in-world session to begin guided validation. Until then, the clipboard remains the full reference list.
                    </div>
                )
            )}

            {isTrainingComplete && (
                <div
                    style={{
                        marginTop: 12,
                        padding: '10px 12px',
                        background: 'rgba(43, 147, 72, 0.12)',
                        color: '#25673a',
                        borderRadius: 12,
                        textAlign: 'center',
                        fontWeight: 700,
                    }}
                >
                    Session complete
                </div>
            )}
        </div>
    )
}
