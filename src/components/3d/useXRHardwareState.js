import { useMemo } from 'react'
import { useXRInputSourceState } from '@react-three/xr'

export function useXRHardwareState() {
    const rightController = useXRInputSourceState('controller', 'right')
    const leftController = useXRInputSourceState('controller', 'left')
    const rightHand = useXRInputSourceState('hand', 'right')
    const leftHand = useXRInputSourceState('hand', 'left')

    return useMemo(() => {
        const activeController = rightController ?? leftController
        const activeHand = rightHand ?? leftHand
        const activePointerSource = activeController ?? activeHand
        const hasControllers = Boolean(activeController)
        const hasHands = Boolean(activeHand)

        return {
            rightController,
            leftController,
            rightHand,
            leftHand,
            activeController,
            activeHand,
            activePointerSource,
            hasControllers,
            hasHands,
            handsOnly: hasHands && !hasControllers,
        }
    }, [leftController, leftHand, rightController, rightHand])
}
