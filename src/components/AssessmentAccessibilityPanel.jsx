import { TRAINING_STEPS, getStepById, useTrainingStore } from '../store/useTrainingStore'
import { getStepSpeechKeywords } from '../training/assessment'

const panelStyle = {
    position: 'absolute',
    top: 22,
    right: 22,
    zIndex: 16,
    width: 'min(360px, calc(100vw - 32px))',
    maxHeight: 'calc(100vh - 44px)',
    padding: 16,
    borderRadius: 18,
    background: 'linear-gradient(180deg, rgba(250, 246, 237, 0.96), rgba(242, 235, 223, 0.94))',
    border: '1px solid rgba(115, 139, 151, 0.18)',
    boxShadow: '0 24px 54px rgba(33, 44, 50, 0.18)',
    color: '#16303d',
    backdropFilter: 'blur(14px)',
    overflow: 'hidden',
    fontFamily: 'system-ui, sans-serif',
}

const sectionTitleStyle = {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#5c8595',
    marginBottom: 8,
}

function stopEvent(event) {
    event.stopPropagation()
}

export function AssessmentAccessibilityPanel() {
    const {
        assessmentListening,
        assessmentRequireSpeech,
        assessmentSpeechSupported,
        assessmentTranscript,
        currentStepId,
        hasTrainingStarted,
        sessionPhase,
        trainingMode,
    } = useTrainingStore()

    const isAssessmentVisible =
        trainingMode === 'assessment' &&
        assessmentRequireSpeech &&
        hasTrainingStarted &&
        sessionPhase !== 'idle'
    if (!isAssessmentVisible) {
        return null
    }

    const currentStep = getStepById(currentStepId)
    const currentStepKeywords = getStepSpeechKeywords(currentStepId)
    const transcriptText = assessmentTranscript?.trim() || 'Listening for narration...'

    return (
        <aside
            data-ui-overlay="true"
            style={panelStyle}
            onPointerDown={stopEvent}
            onPointerUp={stopEvent}
            onClick={stopEvent}
            onContextMenu={stopEvent}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>Speech Access</div>
                    <div style={{ fontSize: 12, color: '#5f7380', marginTop: 3 }}>
                        Live narration transcript and pass keywords
                    </div>
                </div>
                <div
                    style={{
                        padding: '6px 10px',
                        borderRadius: 999,
                        background: assessmentListening ? 'rgba(34, 197, 94, 0.14)' : 'rgba(93, 128, 143, 0.1)',
                        color: assessmentListening ? '#1f6f38' : '#4b6470',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                    }}
                >
                    {assessmentListening ? 'LISTENING' : 'PAUSED'}
                </div>
            </div>

            <div
                style={{
                    padding: 12,
                    borderRadius: 14,
                    background: 'rgba(255, 255, 255, 0.62)',
                    border: '1px solid rgba(112, 139, 153, 0.18)',
                    marginBottom: 14,
                }}
            >
                <div style={sectionTitleStyle}>Recognized Speech</div>
                <div style={{ fontSize: 14, lineHeight: 1.55, color: '#243f4c', minHeight: 54 }}>
                    {assessmentSpeechSupported ? transcriptText : 'Speech recognition is not available in this browser.'}
                </div>
            </div>

            <div
                style={{
                    padding: 12,
                    borderRadius: 14,
                    background: 'rgba(255, 255, 255, 0.54)',
                    border: '1px solid rgba(112, 139, 153, 0.14)',
                    marginBottom: 14,
                }}
            >
                <div style={sectionTitleStyle}>Current Step Keywords</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: '#415967', marginBottom: 6 }}>
                    {currentStep?.shortLabel ?? 'No active step'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {currentStepKeywords.length > 0 ? (
                        currentStepKeywords.map((keyword) => (
                            <span
                                key={`${currentStepId}:${keyword}`}
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: 999,
                                    background: 'rgba(75, 122, 140, 0.12)',
                                    border: '1px solid rgba(75, 122, 140, 0.14)',
                                    fontSize: 12,
                                    color: '#2f5566',
                                }}
                            >
                                {keyword}
                            </span>
                        ))
                    ) : (
                        <span style={{ fontSize: 12, color: '#6b7f89' }}>No keywords defined for this step yet.</span>
                    )}
                </div>
            </div>

            <div
                style={{
                    padding: 12,
                    borderRadius: 14,
                    background: 'rgba(255, 255, 255, 0.54)',
                    border: '1px solid rgba(112, 139, 153, 0.14)',
                    maxHeight: '42vh',
                    overflowY: 'auto',
                }}
            >
                <div style={sectionTitleStyle}>All Assessment Keywords</div>
                <div style={{ display: 'grid', gap: 10 }}>
                    {TRAINING_STEPS.map((step) => (
                        <div
                            key={step.id}
                            style={{
                                paddingBottom: 10,
                                borderBottom: '1px solid rgba(112, 139, 153, 0.12)',
                            }}
                        >
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1f3d49', marginBottom: 4 }}>
                                {step.shortLabel}
                            </div>
                            <div style={{ fontSize: 12, color: '#607680', lineHeight: 1.45, marginBottom: 6 }}>
                                {step.instruction}
                            </div>
                            <div style={{ fontSize: 12, color: '#2f5566', lineHeight: 1.5 }}>
                                {getStepSpeechKeywords(step.id).join(', ') || 'No keywords configured'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    )
}
