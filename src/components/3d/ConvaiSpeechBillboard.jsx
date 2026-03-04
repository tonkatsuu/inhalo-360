import { Billboard, RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useConvaiRuntime } from '../../convai/useConvaiRuntime'
import { useTrainingStore } from '../../store/useTrainingStore'

const MAX_CAPTION_LENGTH = 132

function clampCaption(text) {
    const trimmed = typeof text === 'string' ? text.trim().replace(/\s+/g, ' ') : ''
    if (!trimmed) return ''
    if (trimmed.length <= MAX_CAPTION_LENGTH) {
        return trimmed
    }

    return `${trimmed.slice(0, MAX_CAPTION_LENGTH - 1).trimEnd()}…`
}

export function ConvaiSpeechBillboard(props) {
    const group = useRef()
    const bubbleMaterial = useRef()
    const shadowMaterial = useRef()
    const chipMaterial = useRef()
    const dotMaterial = useRef()
    const [isMounted, setIsMounted] = useState(false)
    const visibilityRef = useRef(0)

    const {
        state,
        agentCaptionText,
        agentCaptionVisible,
        agentCaptionIsStreaming,
        agentDisplayName,
    } = useConvaiRuntime()
    const sessionPhase = useTrainingStore((store) => store.sessionPhase)
    const hasReviewOpen = useTrainingStore((store) => store.hasReviewOpen)

    const statusText =
        state?.agentState === 'listening'
            ? 'Listening...'
            : state?.isThinking
                ? 'Thinking...'
                : state?.isSpeaking
                    ? 'Speaking...'
                    : ''

    const bodyText = clampCaption(agentCaptionText || statusText || (state?.isSpeaking ? '...' : ''))
    const shouldBeVisible =
        agentCaptionVisible ||
        state?.isSpeaking === true ||
        state?.isThinking === true ||
        state?.agentState === 'listening'
    const isRendered = isMounted || shouldBeVisible
    const lineCount = Math.min(3, Math.max(1, Math.ceil((bodyText || '...').length / 38)))
    const bubbleHeight = 0.26 + lineCount * 0.12
    const dotColor = useMemo(() => new THREE.Color('#4ade80'), [])
    const thinkingColor = useMemo(() => new THREE.Color('#fbbf24'), [])
    const listeningColor = useMemo(() => new THREE.Color('#38bdf8'), [])

    useFrame((_state, delta) => {
        if (!isRendered || !group.current) {
            return
        }

        visibilityRef.current = THREE.MathUtils.damp(visibilityRef.current, shouldBeVisible ? 1 : 0, 9, delta)
        const opacity = visibilityRef.current
        const scale = 0.9 + opacity * 0.1

        group.current.scale.setScalar(scale)

        if (bubbleMaterial.current) {
            bubbleMaterial.current.opacity = 0.55 * opacity
            bubbleMaterial.current.emissive.set('#000000')
            bubbleMaterial.current.emissiveIntensity = 0
        }

        if (shadowMaterial.current) {
            shadowMaterial.current.opacity = 0.32 * opacity
        }

        if (chipMaterial.current) {
            chipMaterial.current.opacity = 0.7 * opacity
        }

        if (dotMaterial.current) {
            dotMaterial.current.opacity = 0.9 * opacity
            if (state?.agentState === 'listening') {
                dotMaterial.current.color.copy(listeningColor)
            } else if (state?.isThinking) {
                dotMaterial.current.color.copy(thinkingColor)
            } else {
                dotMaterial.current.color.copy(dotColor)
            }
        }

        if (!shouldBeVisible && opacity < 0.02) {
            setIsMounted(false)
        }
    })

    if (sessionPhase === 'completed' && hasReviewOpen) {
        return null
    }

    if (!isRendered) {
        return null
    }

    return (
        <Billboard {...props} follow lockX={false} lockY={false} lockZ={false}>
            <group ref={group}>
                <RoundedBox args={[1.49, bubbleHeight + 0.04, 0.02]} radius={0.055} smoothness={6} position={[0, 0, -0.018]}>
                    <meshStandardMaterial ref={shadowMaterial} color="#041018" transparent opacity={0.32} />
                </RoundedBox>

                <RoundedBox args={[1.45, bubbleHeight, 0.03]} radius={0.05} smoothness={6}>
                    <meshStandardMaterial
                        ref={bubbleMaterial}
                        color="#0b1620"
                        transparent
                        opacity={0.55}
                        roughness={0.9}
                        metalness={0.02}
                    />
                </RoundedBox>

                <group position={[-0.34, bubbleHeight * 0.5 - 0.09, 0.03]}>
                    <RoundedBox args={[0.58, 0.13, 0.02]} radius={0.045} smoothness={4}>
                        <meshStandardMaterial ref={chipMaterial} color="#102734" transparent opacity={0.7} />
                    </RoundedBox>
                    <mesh position={[-0.22, 0, 0.015]}>
                        <sphereGeometry args={[0.024, 18, 18]} />
                        <meshStandardMaterial ref={dotMaterial} color="#4ade80" transparent opacity={0.9} />
                    </mesh>
                    <Text
                        position={[0.04, -0.002, 0.02]}
                        fontSize={0.055}
                        anchorX="center"
                        anchorY="middle"
                        color="#f8fafc"
                    >
                        {agentDisplayName}
                    </Text>
                </group>

                <Text
                    position={[0, -0.03, 0.035]}
                    fontSize={0.051}
                    maxWidth={1.15}
                    lineHeight={1.2}
                    anchorX="center"
                    anchorY="middle"
                    textAlign="center"
                    color={agentCaptionIsStreaming ? '#f8fafc' : '#d9e5f0'}
                    overflowWrap="break-word"
                >
                    {bodyText || '...'}
                </Text>
            </group>
        </Billboard>
    )
}
