import { BRAND_ICON_PATH, BRAND_NAME } from '../branding'

export function BrandBadge({ subtitle, compact = false, style }) {
    const iconSize = compact ? 34 : 42

    return (
        <div
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: compact ? 10 : 12,
                padding: compact ? '10px 12px' : '12px 14px',
                borderRadius: compact ? 16 : 18,
                background: 'linear-gradient(180deg, rgba(248, 243, 233, 0.95), rgba(238, 230, 216, 0.92))',
                border: '1px solid rgba(104, 130, 141, 0.18)',
                boxShadow: '0 20px 44px rgba(18, 40, 51, 0.14)',
                backdropFilter: 'blur(12px)',
                color: '#173440',
                userSelect: 'none',
                ...style,
            }}
        >
            <img
                src={BRAND_ICON_PATH}
                alt={`${BRAND_NAME} logo`}
                width={iconSize}
                height={iconSize}
                style={{ display: 'block', borderRadius: compact ? 10 : 12, flexShrink: 0 }}
            />
            <div style={{ minWidth: 0 }}>
                <div
                    style={{
                        fontSize: compact ? 16 : 18,
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        lineHeight: 1.1,
                    }}
                >
                    {BRAND_NAME}
                </div>
                {subtitle ? (
                    <div
                        style={{
                            marginTop: 3,
                            fontSize: compact ? 11 : 12,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: '#5a7a88',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {subtitle}
                    </div>
                ) : null}
            </div>
        </div>
    )
}
