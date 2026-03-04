import { useConvaiRuntime } from '../convai/useConvaiRuntime'
import { useTrainingStore } from '../store/useTrainingStore'

const overlayStyle = {
    position: 'absolute',
    inset: 0,
    zIndex: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(4, 10, 18, 0.72)',
    backdropFilter: 'blur(8px)',
}

const cardStyle = {
    width: 'min(520px, calc(100vw - 32px))',
    padding: 24,
    borderRadius: 18,
    background: 'rgba(15, 23, 42, 0.95)',
    color: '#f8fafc',
    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.35)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    fontFamily: 'system-ui, sans-serif',
}

const buttonStyle = {
    padding: '12px 18px',
    borderRadius: 10,
    border: 'none',
    background: '#22c55e',
    color: '#04130a',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
}

export function TrainingStartOverlay() {
    const { enabled, isConfigured } = useConvaiRuntime()
    const { sessionPhase, sessionError, startTraining } = useTrainingStore()

    if (sessionPhase !== 'idle' && sessionPhase !== 'starting') {
        return null
    }

    const isStarting = sessionPhase === 'starting'
    const hasStartError = Boolean(sessionError)
    const canStart = enabled && isConfigured && (!isStarting || hasStartError)
    const helperText = sessionError
        ? sessionError
        : isStarting
            ? 'Connecting to the pharmacist and preparing guided coaching...'
            : enabled && isConfigured
                ? 'Press Start Training to unlock the environment and begin guided inhaler coaching.'
                : 'Guided training requires Convai to be enabled and configured before the session can begin.'

    return (
        <div data-ui-overlay="true" style={overlayStyle}>
            <div style={cardStyle}>
                <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Inhaler Training</div>
                <div style={{ color: '#cbd5e1', lineHeight: 1.6, marginBottom: 18 }}>
                    The room is loaded and waiting. Once you start, the pharmacist will guide you through each step
                    and remain available for questions throughout the session.
                </div>
                <div
                    style={{
                        padding: 14,
                        borderRadius: 12,
                        background: 'rgba(148, 163, 184, 0.12)',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        color: sessionError ? '#fca5a5' : '#e2e8f0',
                        marginBottom: 18,
                        lineHeight: 1.5,
                    }}
                >
                    {helperText}
                </div>
                <button
                    type="button"
                    style={{
                        ...buttonStyle,
                        opacity: canStart ? 1 : 0.55,
                        cursor: canStart ? 'pointer' : 'not-allowed',
                    }}
                    disabled={!canStart}
                    onClick={startTraining}
                >
                    {isStarting && !hasStartError ? 'Connecting...' : hasStartError ? 'Retry Start' : 'Start Training'}
                </button>
            </div>
        </div>
    )
}
