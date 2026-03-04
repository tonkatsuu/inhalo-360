const DEV_MODE = import.meta.env.DEV

function toOptionalString(value) {
    const trimmed = typeof value === 'string' ? value.trim() : ''
    return trimmed.length > 0 ? trimmed : null
}

export function readConvaiConfig() {
    const enabled = import.meta.env.VITE_ENABLE_CONVAI === 'true'
    const apiKey = toOptionalString(import.meta.env.VITE_CONVAI_API_KEY)
    const characterId = toOptionalString(import.meta.env.VITE_CONVAI_CHARACTER_ID)
    const missingKeys = []

    if (enabled && !apiKey) {
        missingKeys.push('VITE_CONVAI_API_KEY')
    }

    if (enabled && !characterId) {
        missingKeys.push('VITE_CONVAI_CHARACTER_ID')
    }

    return {
        enabled,
        apiKey,
        characterId,
        isConfigured: enabled && missingKeys.length === 0,
        missingKeys,
    }
}

readConvaiConfig.isDev = DEV_MODE
