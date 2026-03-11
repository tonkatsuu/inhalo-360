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
    } = useTrainingStore()

    const { state: convaiState, audioControls } = useConvaiRuntime()
    const isRecording = convaiState?.isConnected === true && audioControls?.isAudioMuted === false

    const currentStep = getStepById(currentStepId)
    const visibleSteps = getVisibleTrainingSteps(secondDoseChoice)
    const statusText = getStatusText(sessionPhase, sessionError)
    const controlHints = getControlHints(inputMode, currentStep)
    const desktopFlowPreview = getDesktopFlowPreview(visibleSteps, currentStepId)
    const showLiveTraining = isSessionRunning(sessionPhase) || sessionPhase === 'completed'

    return (
        <div
            style={{
                position: 'absolute',
                right: 24,
                bottom: 22,
                zIndex: 10,
                width: 350,
                padding: '18px 18px 16px',
                borderRadius: 20,
                background: 'linear-gradient(180deg, rgba(248, 243, 233, 0.94), rgba(240, 233, 221, 0.92))',
                border: '1px solid rgba(115, 139, 151, 0.18)',
                boxShadow: '0 24px 54px rgba(33, 44, 50, 0.18)',
                color: '#16303d',
                backdropFilter: 'blur(14px)',
                userSelect: 'none',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <BrandBadge compact subtitle="Ava coaching" />
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
                    {isRecording && (
                        <div style={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
                            RECORDING
                        </div>
                    )}
                    {inputMode === 'xr' ? 'Quest / XR' : 'Desktop'}
                </div>
            </div>

            <div
                style={{
                    marginBottom: 12,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: 'rgba(93, 128, 143, 0.08)',
                    color: sessionError ? '#b84747' : '#506976',
                    lineHeight: 1.45,
                    fontSize: 13,
                }}
            >
                {statusText}
            </div>

            {showLiveTraining && currentStep && (
                <div
                    style={{
                        marginBottom: 14,
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

            {showLiveTraining ? (
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
            ) : (
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
