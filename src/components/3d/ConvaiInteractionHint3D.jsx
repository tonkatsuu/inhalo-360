import { Billboard, RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useConvaiRuntime } from '../../convai/useConvaiRuntime'
import { useTrainingStore } from '../../store/useTrainingStore'
import { useXRHardwareState } from './useXRHardwareState'

const PANEL_WIDTH = 0.76
const PANEL_HEIGHT = 0.22
const FLOAT_AMPLITUDE = 0.006
const PANEL_RENDER_ORDER = 30
const TEXT_RENDER_ORDER = 31

export function ConvaiInteractionHint3D(props) {
    const group = useRef()
    const shadowMaterial = useRef()
    const borderMaterial = useRef()
    const panelMaterial = useRef()
    const chipMaterial = useRef()
    const dotMaterial = useRef()
    const visibilityRef = useRef(0)
    const floatTimeRef = useRef(0)

    const xrMode = useXR((state) => state.mode)
    const { handsOnly } = useXRHardwareState()
    const { enabled, isConfigured, state } = useConvaiRuntime()
    const sessionPhase = useTrainingStore((store) => store.sessionPhase)
    const hasReviewOpen = useTrainingStore((store) => store.hasReviewOpen)
    const isClipboardFocused = useTrainingStore((store) => store.isClipboardFocused)

    const idleDotColor = useMemo(() => new THREE.Color('#67cdec'), [])
    const isXR = xrMode === 'immersive-vr'
    const shouldBeVisible =
        enabled &&
        isConfigured &&
        state?.isConnected === true &&
        state?.agentState !== 'listening' &&
        state?.isThinking !== true &&
        state?.isSpeaking !== true &&
        !isClipboardFocused &&
        !(sessionPhase === 'completed' && hasReviewOpen)

    const interactionCopy = isXR ? (handsOnly ? 'Controllers required to talk' : 'Hold X or Y on left controller') : 'Hold Space to talk'

    useFrame((_state, delta) => {
        if (!group.current) {
            return
        }

        visibilityRef.current = THREE.MathUtils.damp(visibilityRef.current, shouldBeVisible ? 1 : 0, 9, delta)
        const opacity = visibilityRef.current
        floatTimeRef.current += delta

        group.current.position.y = Math.sin(floatTimeRef.current * 1.45) * FLOAT_AMPLITUDE
        group.current.scale.setScalar(0.001 + Math.pow(opacity, 0.7) * 0.999)

        if (shadowMaterial.current) {
            shadowMaterial.current.opacity = 0.18 * opacity
        }

        if (borderMaterial.current) {
            borderMaterial.current.opacity = 0.6 * opacity
        }

        if (panelMaterial.current) {
            panelMaterial.current.opacity = 0.82 * opacity
        }

        if (chipMaterial.current) {
            chipMaterial.current.opacity = 0.72 * opacity
        }

        if (dotMaterial.current) {
            dotMaterial.current.opacity = 0.88 * opacity
            dotMaterial.current.color.copy(idleDotColor)
        }
    })

    if (!enabled || !isConfigured) {
        return null
    }

    return (
        <Billboard {...props} follow lockX={false} lockY={false} lockZ={false}>
            <group ref={group}>
                <RoundedBox
                    args={[PANEL_WIDTH + 0.04, PANEL_HEIGHT + 0.04, 0.018]}
                    radius={0.045}
                    smoothness={6}
                    position={[0, 0, -0.015]}
                    renderOrder={PANEL_RENDER_ORDER}
                >
                    <meshStandardMaterial ref={shadowMaterial} color="#041018" transparent opacity={0} depthTest={false} depthWrite={false} />
                </RoundedBox>

                <RoundedBox
                    args={[PANEL_WIDTH, PANEL_HEIGHT, 0.022]}
                    radius={0.04}
                    smoothness={6}
                    position={[0, 0, -0.008]}
                    renderOrder={PANEL_RENDER_ORDER}
                >
                    <meshStandardMaterial ref={borderMaterial} color="#274556" transparent opacity={0} depthTest={false} depthWrite={false} />
                </RoundedBox>

                <RoundedBox args={[PANEL_WIDTH - 0.03, PANEL_HEIGHT - 0.03, 0.024]} radius={0.035} smoothness={6} renderOrder={PANEL_RENDER_ORDER}>
                    <meshStandardMaterial
                        ref={panelMaterial}
                        color="#0b1620"
                        transparent
                        opacity={0}
                        roughness={0.9}
                        metalness={0.02}
                        depthTest={false}
                        depthWrite={false}
                    />
                </RoundedBox>

                <group position={[-0.14, 0.058, 0.02]}>
                    <RoundedBox args={[0.34, 0.095, 0.016]} radius={0.036} smoothness={4} renderOrder={PANEL_RENDER_ORDER}>
                        <meshStandardMaterial ref={chipMaterial} color="#102734" transparent opacity={0} depthTest={false} depthWrite={false} />
                    </RoundedBox>
                    <mesh position={[-0.11, 0, 0.014]} renderOrder={TEXT_RENDER_ORDER}>
                        <sphereGeometry args={[0.018, 16, 16]} />
                        <meshStandardMaterial ref={dotMaterial} color="#67cdec" transparent opacity={0} depthTest={false} depthWrite={false} />
                    </mesh>
                    <Text
                        position={[0.025, -0.002, 0.018]}
                        fontSize={0.034}
                        anchorX="center"
                        anchorY="middle"
                        color="#f8fafc"
                        renderOrder={TEXT_RENDER_ORDER}
                        material-depthTest={false}
                        material-depthWrite={false}
                    >
                        Ava Q&A
                    </Text>
                </group>

                <Text
                    position={[0, -0.005, 0.022]}
                    fontSize={0.046}
                    maxWidth={0.62}
                    lineHeight={1.08}
                    anchorX="center"
                    anchorY="middle"
                    textAlign="center"
                    color="#f8fafc"
                    renderOrder={TEXT_RENDER_ORDER}
                    material-depthTest={false}
                    material-depthWrite={false}
                >
                    Ask Ava a question
                </Text>

                <Text
                    position={[0, -0.078, 0.022]}
                    fontSize={0.03}
                    maxWidth={0.64}
                    lineHeight={1.12}
                    anchorX="center"
                    anchorY="middle"
                    textAlign="center"
                    color="#a9c4d3"
                    renderOrder={TEXT_RENDER_ORDER}
                    material-depthTest={false}
                    material-depthWrite={false}
                >
                    {interactionCopy}
                </Text>
            </group>
        </Billboard>
    )
}
