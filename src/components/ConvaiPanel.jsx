function panelButtonStyle({ disabled = false, tone = 'default' } = {}) {
    const tones = {
        default: {
            background: 'rgba(255, 255, 255, 0.08)',
            borderColor: 'rgba(255, 255, 255, 0.12)',
            color: '#f5f5f5',
        },
        primary: {
            background: '#2563eb',
            borderColor: '#2563eb',
            color: '#ffffff',
        },
        danger: {
            background: '#b91c1c',
            borderColor: '#b91c1c',
            color: '#ffffff',
        },
    }

    const toneStyles = tones[tone] ?? tones.default

    return {
        padding: '8px 12px',
        borderRadius: 8,
        border: `1px solid ${toneStyles.borderColor}`,
        background: toneStyles.background,
        color: toneStyles.color,
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
    }
}

const panelStyle = {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 30,
    width: 280,
    padding: 14,
    borderRadius: 12,
    background: 'rgba(10, 14, 24, 0.88)',
    color: '#f5f5f5',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 18px 40px rgba(0, 0, 0, 0.28)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    fontFamily: 'system-ui, sans-serif',
}

function StatusRow({ label, value, tone = '#cbd5e1' }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
            <span style={{ color: '#94a3b8' }}>{label}</span>
            <span style={{ color: tone, textAlign: 'right' }}>{value}</span>
        </div>
    )
}

export function ConvaiPanel({
    enabled,
    isConfigured,
    missingKeys = [],
    state,
    isThinking = false,
    isSpeaking = false,
    onConnect,
    onDisconnect,
    onMute,
    onUnmute,
    isAudioMuted = true,
}) {
    const isConnected = state?.isConnected === true
    const statusLabel = !enabled
        ? 'Disabled'
        : !isConfigured
            ? 'Missing configuration'
            : isConnected
                ? state?.agentState || 'Connected'
                : 'Ready to connect'

    const handlePointerEvent = (event) => {
        event.stopPropagation()
    }

    return (
        <aside
            data-ui-overlay="true"
            style={panelStyle}
            onPointerDown={handlePointerEvent}
            onPointerUp={handlePointerEvent}
            onClick={handlePointerEvent}
            onContextMenu={handlePointerEvent}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Convai Debug</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{enabled ? 'Enabled' : 'Disabled'}</div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
                <StatusRow label="Status" value={statusLabel} tone={isConfigured ? '#f8fafc' : '#fbbf24'} />
                <StatusRow label="Thinking" value={isThinking ? 'Yes' : 'No'} tone={isThinking ? '#fbbf24' : '#cbd5e1'} />
                <StatusRow label="Speaking" value={isSpeaking ? 'Yes' : 'No'} tone={isSpeaking ? '#4ade80' : '#cbd5e1'} />
                <StatusRow label="Mic" value={isAudioMuted ? 'Muted' : 'Live'} tone={isAudioMuted ? '#f87171' : '#4ade80'} />
            </div>

            {!isConfigured && missingKeys.length > 0 && (
                <div
                    style={{
                        marginTop: 12,
                        padding: 10,
                        borderRadius: 10,
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        color: '#fde68a',
                        fontSize: 12,
                        lineHeight: 1.4,
                    }}
                >
                    Missing: {missingKeys.join(', ')}
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                {!isConnected ? (
                    <button
                        type="button"
                        style={panelButtonStyle({ tone: 'primary', disabled: !isConfigured })}
                        disabled={!isConfigured}
                        onClick={onConnect}
                    >
                        Connect
                    </button>
                ) : (
                    <button
                        type="button"
                        style={panelButtonStyle({ tone: 'danger' })}
                        onClick={onDisconnect}
                    >
                        Disconnect
                    </button>
                )}

                <button
                    type="button"
                    style={panelButtonStyle({ disabled: !isConfigured || !isConnected })}
                    disabled={!isConfigured || !isConnected}
                    onClick={isAudioMuted ? onUnmute : onMute}
                >
                    {isAudioMuted ? 'Unmute Mic' : 'Mute Mic'}
                </button>
            </div>
        </aside>
    )
}
