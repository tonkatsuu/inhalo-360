import { useTrainingStore } from '../store/useTrainingStore'

const overlayStyle = {
    position: 'absolute',
    inset: 0,
    zIndex: 55,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(3, 7, 18, 0.68)',
    backdropFilter: 'blur(8px)',
}

const cardStyle = {
    width: 'min(640px, calc(100vw - 32px))',
    maxHeight: '80vh',
    overflowY: 'auto',
    padding: 24,
    borderRadius: 18,
    background: 'rgba(15, 23, 42, 0.96)',
    color: '#f8fafc',
    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.35)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    fontFamily: 'system-ui, sans-serif',
}

function buttonStyle(tone) {
    const styles = {
        primary: {
            background: '#22c55e',
            color: '#04130a',
        },
        secondary: {
            background: 'rgba(148, 163, 184, 0.16)',
            color: '#e2e8f0',
        },
    }

    return {
        padding: '10px 16px',
        borderRadius: 10,
        border: 'none',
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        ...styles[tone],
    }
}

export function TrainingReviewOverlay() {
    const { sessionPhase, hasReviewOpen, mistakes, resetTrainingSession, closeReview } = useTrainingStore()

    if (sessionPhase !== 'completed' || !hasReviewOpen) {
        return null
    }

    return (
        <div data-ui-overlay="true" style={overlayStyle}>
            <div style={cardStyle}>
                <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 10 }}>Training Complete</div>
                <div style={{ color: '#cbd5e1', marginBottom: 18, lineHeight: 1.6 }}>
                    Review the detected issues from this attempt. You can ask the pharmacist follow-up questions now,
                    or retry the full flow from the beginning.
                </div>

                {mistakes.length === 0 ? (
                    <div
                        style={{
                            padding: 14,
                            borderRadius: 12,
                            background: 'rgba(34, 197, 94, 0.12)',
                            border: '1px solid rgba(34, 197, 94, 0.25)',
                            color: '#bbf7d0',
                            marginBottom: 20,
                        }}
                    >
                        No detectable mistakes recorded in this attempt.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                        {mistakes.map((mistake) => (
                            <div
                                key={mistake.id}
                                style={{
                                    padding: 14,
                                    borderRadius: 12,
                                    background: 'rgba(248, 113, 113, 0.08)',
                                    border: '1px solid rgba(248, 113, 113, 0.18)',
                                }}
                            >
                                <div style={{ fontWeight: 700, marginBottom: 6 }}>{mistake.message}</div>
                                <div style={{ color: '#cbd5e1', lineHeight: 1.5 }}>{mistake.correction}</div>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" style={buttonStyle('primary')} onClick={resetTrainingSession}>
                        Try Again
                    </button>
                    <button type="button" style={buttonStyle('secondary')} onClick={closeReview}>
                        Close Review
                    </button>
                </div>
            </div>
        </div>
    )
}
