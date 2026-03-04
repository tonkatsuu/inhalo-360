import { useContext } from 'react'
import { ConvaiContext } from './runtime-context'

export function useConvaiRuntime() {
    return useContext(ConvaiContext)
}
