import { Billboard, RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { useMemo, useRef, useState, useEffect } from 'react'
import * as THREE from 'three'
import { useConvaiRuntime } from '../../convai/useConvaiRuntime'
import { useTrainingStore } from '../../store/useTrainingStore'
import { useXRHardwareState } from './useXRHardwareState'

const PANEL_RENDER_ORDER = 30
const TEXT_RENDER_ORDER = 31

function clampCaption(text) {
    return typeof text === 'string' ? text.trim().replace(/\s+/g, ' ') : ''
}

export function ConvaiSpeechBillboard(props) {
    const group = useRef()
    const bubbleMaterial = useRef()
    const shadowMaterial = useRef()
    const borderMaterial = useRef()
    const chipMaterial = useRef()
    const dotMaterial = useRef()
    const [isMounted, setIsMounted] = useState(false)
    const [lastMessage, setLastMessage] = useState('Ask Ava a question...')
    const visibilityRef = useRef(0)

    const xrMode = useXR((state) => state.mode)
    const { handsOnly } = useXRHardwareState()
    const {
        enabled,
        isConfigured,
        state,
        agentCaptionText,
        agentCaptionIsStreaming,
        agentDisplayName,
        isMicOpen,
        audioControls,
    } = useConvaiRuntime()
    const sessionPhase = useTrainingStore((store) => store.sessionPhase)
    const hasReviewOpen = useTrainingStore((store) => store.hasReviewOpen)
    const isClipboardFocused = useTrainingStore((store) => store.isClipboardFocused)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    useEffect(() => {
        const text = clampCaption(agentCaptionText)
        if (text) {
            setLastMessage(text)
        }
    }, [agentCaptionText])

    const isXR = xrMode === 'immersive-vr'
    const interactionCopy = isXR ? (handsOnly ? 'Controllers required to talk in current build' : 'Hold X or Y on left controller to talk') : 'Hold Space to talk'

    const isListening = state?.agentState === 'listening'
    const isThinking = state?.isThinking === true
    const isSpeaking = state?.isSpeaking === true
    const isRecording = isMicOpen || (!audioControls?.isAudioMuted && state?.isConnected)

    const isReadyOrActive = enabled && isConfigured && state?.isConnected
    
    // Idle means connected, not processing speech, and not looking at clipboard.
    const isIdle = isReadyOrActive && !isListening && !isThinking && !isSpeaking && !isClipboardFocused

    const shouldBeVisible = isReadyOrActive && !isClipboardFocused && !(sessionPhase === 'completed' && hasReviewOpen)

    const currentCaption = clampCaption(agentCaptionText)
    const displayText = (isSpeaking && currentCaption) ? currentCaption : lastMessage
    
    const isRendered = isMounted

    const headerText = isRecording ? 'LIVE' : isListening ? 'Listening...' : isThinking ? 'Thinking...' : agentDisplayName || 'Ava'

    const lineCount = Math.min(6, Math.max(1, Math.ceil((displayText || '...').length / 32)))
    const bubbleHeight = Math.max(0.35, 0.24 + lineCount * 0.08)
    const bubbleWidth = 1.15

    const dotColor = useMemo(() => new THREE.Color('#4ade80'), [])
    const thinkingColor = useMemo(() => new THREE.Color('#fbbf24'), [])
    const listeningColor = useMemo(() => new THREE.Color('#38bdf8'), [])
    const recordingColor = useMemo(() => new THREE.Color('#ef4444'), [])
    const idleColor = useMemo(() => new THREE.Color('#67cdec'), [])

    useFrame((_state, delta) => {
        if (!isRendered || !group.current) {
            return
        }

        visibilityRef.current = THREE.MathUtils.damp(visibilityRef.current, shouldBeVisible ? 1 : 0, 9, delta)
        const opacity = Math.max(0, Math.min(1, visibilityRef.current))
        const scale = 0.95 + opacity * 0.05

        group.current.scale.setScalar(Math.max(0.001, scale * Math.pow(opacity, 0.5)))
        // Anchor vertically to roughly the middle, perhaps slight float
        group.current.position.y = (bubbleHeight / 2) - 0.15

        if (bubbleMaterial.current) {
            bubbleMaterial.current.opacity = 0.82 * opacity
        }

        if (borderMaterial.current) {
            borderMaterial.current.opacity = 0.6 * opacity
        }

        if (shadowMaterial.current) {
            shadowMaterial.current.opacity = 0.18 * opacity
        }

        if (chipMaterial.current) {
            chipMaterial.current.opacity = 0.72 * opacity
        }

        if (dotMaterial.current) {
            dotMaterial.current.opacity = 0.9 * opacity
            
            if (isRecording) {
                dotMaterial.current.color.copy(recordingColor)
                // Pulse effect for recording
                const pulse = 0.7 + Math.sin(_state.clock.elapsedTime * 6) * 0.3
                dotMaterial.current.opacity = pulse * opacity
            } else if (state?.agentState === 'listening') {
                dotMaterial.current.color.copy(listeningColor)
            } else if (state?.isThinking) {
                dotMaterial.current.color.copy(thinkingColor)
            } else if (isIdle) {
                dotMaterial.current.color.copy(idleColor)
            } else {
                dotMaterial.current.color.copy(dotColor)
            }
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
                {/* Shadow */}
                <RoundedBox
                    args={[bubbleWidth + 0.04, bubbleHeight + 0.04, 0.018]}
                    radius={0.045}
                    smoothness={6}
                    position={[0, 0, -0.015]}
                    renderOrder={PANEL_RENDER_ORDER}
                >
                    <meshStandardMaterial ref={shadowMaterial} color="#041018" transparent opacity={0.18} depthTest={false} depthWrite={false} />
                </RoundedBox>

                {/* Border */}
                <RoundedBox
                    args={[bubbleWidth, bubbleHeight, 0.022]}
                    radius={0.04}
                    smoothness={6}
                    position={[0, 0, -0.008]}
                    renderOrder={PANEL_RENDER_ORDER}
                >
                    <meshStandardMaterial ref={borderMaterial} color="#274556" transparent opacity={0.6} depthTest={false} depthWrite={false} />
                </RoundedBox>

                {/* Background */}
                <RoundedBox args={[bubbleWidth - 0.03, bubbleHeight - 0.03, 0.024]} radius={0.035} smoothness={6} renderOrder={PANEL_RENDER_ORDER}>
                    <meshStandardMaterial
                        ref={bubbleMaterial}
                        color="#0b1620"
                        transparent
                        opacity={0.82}
                        roughness={0.9}
                        metalness={0.02}
                        depthTest={false}
                        depthWrite={false}
                    />
                </RoundedBox>

                {/* Header Chip */}
                <group position={[-(bubbleWidth * 0.5) + 0.28, bubbleHeight * 0.5 - 0.06, 0.02]}>
                    <RoundedBox args={[0.48, 0.08, 0.016]} radius={0.03} smoothness={4} renderOrder={PANEL_RENDER_ORDER}>
                        <meshStandardMaterial ref={chipMaterial} color="#102734" transparent opacity={0.72} depthTest={false} depthWrite={false} />
                    </RoundedBox>
                    <mesh position={[-0.18, 0, 0.014]} renderOrder={TEXT_RENDER_ORDER}>
                        <sphereGeometry args={[0.014, 16, 16]} />
                        <meshStandardMaterial ref={dotMaterial} color="#4ade80" transparent opacity={0.9} depthTest={false} depthWrite={false} />
                    </mesh>
                    <Text
                        position={[0.025, -0.002, 0.018]}
                        fontSize={0.032}
                        anchorX="center"
                        anchorY="middle"
                        color="#f8fafc"
                        depthTest={false}
                        depthWrite={false}
                        renderOrder={TEXT_RENDER_ORDER}
                    >
                        {headerText}
                    </Text>
                </group>

                {/* Main Text Body */}
                <Text
                    position={[0, 0.02, 0.022]}
                    fontSize={0.042}
                    maxWidth={bubbleWidth - 0.15}
                    lineHeight={1.2}
                    anchorX="center"
                    anchorY="middle"
                    textAlign="center"
                    color={agentCaptionIsStreaming && !isIdle ? '#ffffff' : '#f8fafc'}
                    overflowWrap="break-word"
                    depthTest={false}
                    depthWrite={false}
                    renderOrder={TEXT_RENDER_ORDER}
                >
                    {displayText}
                </Text>

                {/* Footer Interaction Instruction */}
                <Text
                    position={[0, -(bubbleHeight * 0.5) + 0.05, 0.022]}
                    fontSize={0.026}
                    maxWidth={0.8}
                    lineHeight={1.12}
                    anchorX="center"
                    anchorY="middle"
                    textAlign="center"
                    color="#a9c4d3"
                    depthTest={false}
                    depthWrite={false}
                    renderOrder={TEXT_RENDER_ORDER}
                >
                    {interactionCopy}
                </Text>
            </group>
        </Billboard>
    )
}
