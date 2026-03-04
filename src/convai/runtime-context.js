import { createContext } from 'react'

const noop = () => {}

export const defaultConvaiRuntime = {
    enabled: false,
    isConfigured: false,
    missingKeys: [],
    client: null,
    state: null,
    audioControls: null,
    room: null,
    connect: noop,
    disconnect: noop,
    mute: noop,
    unmute: noop,
}

export const ConvaiContext = createContext(defaultConvaiRuntime)
