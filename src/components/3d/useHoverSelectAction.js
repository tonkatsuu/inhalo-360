import { useEffect } from 'react'
import { useXR, useXRInputSourceEvent } from '@react-three/xr'

export function useHoverSelectAction(isActive, hoverRef, handlers) {
    const xrMode = useXR((state) => state.mode)
    const isInXR = xrMode === 'immersive-vr'

    useXRInputSourceEvent(
        isInXR ? 'all' : undefined,
        'select',
        (event) => {
            if (!isActive) {
                return
            }

            const action = hoverRef.current
            const handler = action ? handlers[action] : undefined
            if (!handler) {
                return
            }

            event.preventDefault?.()
            handler()
        },
        [handlers, isActive, isInXR],
    )

    useEffect(() => {
        if (!isActive || isInXR) {
            return undefined
        }

        const handlePointerDown = (event) => {
            if (event.button !== 0) return

            const action = hoverRef.current
            const handler = action ? handlers[action] : undefined
            if (!handler) {
                return
            }

            event.preventDefault()
            handler()
        }

        window.addEventListener('pointerdown', handlePointerDown)
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown)
        }
    }, [handlers, hoverRef, isActive, isInXR])
}
