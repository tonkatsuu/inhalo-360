import { useXRControllerButtonEvent, useXRInputSourceState } from '@react-three/xr'
import { useConvaiRuntime } from '../../convai/useConvaiRuntime'

export function ConvaiXRMicControls() {
    const { state, startRecord, stopRecord } = useConvaiRuntime()
    const isConnected = state?.isConnected === true

    const leftController = useXRInputSourceState('controller', 'left')

    useXRControllerButtonEvent(leftController, 'x-button', (buttonState) => {
        if (!isConnected) return
        if (buttonState === 'pressed') {
            startRecord()
        } else if (buttonState === 'default') {
            stopRecord()
        }
    })

    useXRControllerButtonEvent(leftController, 'y-button', (buttonState) => {
        if (!isConnected) return
        if (buttonState === 'pressed') {
            startRecord()
        } else if (buttonState === 'default') {
            stopRecord()
        }
    })

    return null
}
