import { RoundedBox, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { getStepById, useTrainingStore } from '../../store/useTrainingStore'
import { BrandChip3D } from './BrandChip3D'

const PANEL_WIDTH = 1.34
const PANEL_HEIGHT = 1.12
const PANEL_DEPTH = 0.04
const BUTTON_WIDTH = 0.48
const BUTTON_HEIGHT = 0.16
const FLOAT_AMPLITUDE = 0.012

function clampLine(text, maxLength = 56) {
    const normalized = typeof text === 'string' ? text.trim().replace(/\s+/g, ' ') : ''
    if (!normalized) return ''
    if (normalized.length <= maxLength) {
        return normalized
    }

    return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

export function TrainingReviewPanel3D(props) {
    const root = useRef()
    const retryButtonRef = useRef()
    const closeButtonRef = useRef()
    const prevButtonRef = useRef()
    const nextButtonRef = useRef()
    const glassMaterial = useRef()
    const borderMaterial = useRef()
    const chipMaterial = useRef()
    const shadowMaterial = useRef()
    const retryMaterial = useRef()
    const closeMaterial = useRef()
    const prevMaterial = useRef()
    const nextMaterial = useRef()
    const fadeRef = useRef(0)
    const floatTimeRef = useRef(0)
    const hoverRef = useRef(null)
    const [isMounted, setIsMounted] = useState(false)
    const [hoveredButton, setHoveredButton] = useState(null)
    const [currentIssueIndex, setCurrentIssueIndex] = useState(0)

    const camera = useThree((state) => state.camera)
    const raycaster = useMemo(() => new THREE.Raycaster(), [])
    const forward = useMemo(() => new THREE.Vector3(), [])
    const lookTarget = useMemo(() => new THREE.Vector3(), [])

    const { sessionPhase, hasReviewOpen, mistakes, stepResults, resetTrainingSession, closeReview } = useTrainingStore()

    const isVisible = sessionPhase === 'completed' && hasReviewOpen
    const isRendered = isMounted || isVisible

    const reviewItems = stepResults
        .filter((result) => result.failures > 0)
        .map((result) => {
            const step = getStepById(result.stepId)
            const latestMistake = [...mistakes].reverse().find((mistake) => mistake.stepId === result.stepId)
            return {
                id: result.stepId,
                title: clampLine(`${step?.shortLabel ?? step?.instruction ?? result.stepId}: ${result.failures} correction${result.failures === 1 ? '' : 's'} needed`, 52),
                detail: clampLine(
                    latestMistake?.correction ??
                        `Completed after ${result.attempts} attempts. The user improved on retry during this step.`,
                    52,
                ),
            }
        })

    const summaryText =
        reviewItems.length === 0
            ? 'No major coaching corrections were needed. Ava is still available if you want follow-up advice.'
            : `${reviewItems.length} step${reviewItems.length === 1 ? '' : 's'} needed correction. Review the key fixes below, then retry if needed.`
    const activeIssue = reviewItems.length > 0 ? reviewItems[Math.min(currentIssueIndex, reviewItems.length - 1)] : null

    const handlePrimary = useCallback(() => {
        resetTrainingSession()
    }, [resetTrainingSession])

    const handleSecondary = useCallback(() => {
        closeReview()
    }, [closeReview])

    const handlePrevIssue = useCallback(() => {
        setCurrentIssueIndex((index) => (reviewItems.length === 0 ? 0 : (index - 1 + reviewItems.length) % reviewItems.length))
    }, [reviewItems.length])

    const handleNextIssue = useCallback(() => {
        setCurrentIssueIndex((index) => (reviewItems.length === 0 ? 0 : (index + 1) % reviewItems.length))
    }, [reviewItems.length])

    useEffect(() => {
        if (!isRendered) {
            return undefined
        }

        const handlePointerDown = (event) => {
            if (event.button !== 0) return
            if (hoverRef.current === 'retry') {
                event.preventDefault()
                handlePrimary()
            }
            if (hoverRef.current === 'close') {
                event.preventDefault()
                handleSecondary()
            }
            if (hoverRef.current === 'prev') {
                event.preventDefault()
                handlePrevIssue()
            }
            if (hoverRef.current === 'next') {
                event.preventDefault()
                handleNextIssue()
            }
        }

        window.addEventListener('pointerdown', handlePointerDown)
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown)
        }
    }, [handleNextIssue, handlePrevIssue, handlePrimary, handleSecondary, isRendered])

    useFrame((_state, delta) => {
        if (!isRendered || !root.current) {
            return
        }

        fadeRef.current = THREE.MathUtils.damp(fadeRef.current, isVisible ? 1 : 0, 10, delta)
        const opacity = fadeRef.current
        const scale = 0.92 + opacity * 0.08

        root.current.scale.setScalar(scale)
        floatTimeRef.current += delta
        root.current.position.y = 0.03 + Math.sin(floatTimeRef.current * 1.4) * FLOAT_AMPLITUDE
        lookTarget.copy(camera.position)
        root.current.lookAt(lookTarget)

        camera.getWorldDirection(forward)
        raycaster.set(camera.position, forward)

        let nextHover = null
        if (retryButtonRef.current && raycaster.intersectObject(retryButtonRef.current, true).length > 0) {
            nextHover = 'retry'
        } else if (closeButtonRef.current && raycaster.intersectObject(closeButtonRef.current, true).length > 0) {
            nextHover = 'close'
        } else if (prevButtonRef.current && raycaster.intersectObject(prevButtonRef.current, true).length > 0) {
            nextHover = 'prev'
        } else if (nextButtonRef.current && raycaster.intersectObject(nextButtonRef.current, true).length > 0) {
            nextHover = 'next'
        }

        hoverRef.current = nextHover
        if (nextHover !== hoveredButton) {
            setHoveredButton(nextHover)
        }

        if (glassMaterial.current) {
            glassMaterial.current.opacity = 0.92 * opacity
        }

        if (borderMaterial.current) {
            borderMaterial.current.opacity = 0.62 * opacity
        }

        if (chipMaterial.current) {
            chipMaterial.current.opacity = 0.8 * opacity
        }

        if (shadowMaterial.current) {
            shadowMaterial.current.opacity = 0.34 * opacity
        }

        if (retryMaterial.current) {
            retryMaterial.current.color.set(hoveredButton === 'retry' ? '#34d399' : '#22c55e')
            retryMaterial.current.opacity = 0.96 * opacity
        }

        if (closeMaterial.current) {
            closeMaterial.current.color.set(hoveredButton === 'close' ? '#50616e' : '#374550')
            closeMaterial.current.opacity = 0.9 * opacity
        }

        if (prevMaterial.current) {
            prevMaterial.current.color.set(hoveredButton === 'prev' ? '#50616e' : '#26333d')
            prevMaterial.current.opacity = 0.88 * opacity
        }

        if (nextMaterial.current) {
            nextMaterial.current.color.set(hoveredButton === 'next' ? '#50616e' : '#26333d')
            nextMaterial.current.opacity = 0.88 * opacity
        }

        if (!isVisible && opacity < 0.025) {
            hoverRef.current = null
            if (hoveredButton) {
                setHoveredButton(null)
            }
            setIsMounted(false)
        }
    })

    if (!isRendered) {
        return null
    }

    return (
        <group {...props}>
            <group ref={root}>
                <RoundedBox args={[PANEL_WIDTH + 0.18, PANEL_HEIGHT + 0.18, 0.02]} radius={0.085} smoothness={6} position={[0, 0, -0.04]}>
                    <meshStandardMaterial ref={shadowMaterial} color="#02060a" transparent opacity={0.34} />
                </RoundedBox>

                <RoundedBox args={[PANEL_WIDTH + 0.06, PANEL_HEIGHT + 0.06, PANEL_DEPTH]} radius={0.065} smoothness={6} position={[0, 0, -0.02]}>
                    <meshStandardMaterial ref={borderMaterial} color="#3f6f82" transparent opacity={0.62} />
                </RoundedBox>

                <RoundedBox args={[PANEL_WIDTH, PANEL_HEIGHT, PANEL_DEPTH]} radius={0.06} smoothness={6}>
                    <meshStandardMaterial ref={glassMaterial} color="#09131b" transparent opacity={0.92} roughness={0.98} metalness={0.01} />
                </RoundedBox>

                <BrandChip3D position={[-0.2, 0.38, 0.03]} width={0.64} materialRef={chipMaterial} />

                <Text
                    position={[0, 0.22, 0.05]}
                    fontSize={0.074}
                    maxWidth={0.9}
                    lineHeight={1}
                    textAlign="center"
                    anchorX="center"
                    anchorY="middle"
                    color="#f8fafc"
                >
                    Training Complete
                </Text>

                <Text
                    position={[0, 0.04, 0.05]}
                    fontSize={0.039}
                    maxWidth={0.84}
                    lineHeight={1.08}
                    textAlign="center"
                    anchorX="center"
                    anchorY="middle"
                    color="#c8d6e3"
                >
                    {summaryText}
                </Text>

                {activeIssue ? (
                    <group position={[0, -0.09, 0.04]}>
                        <RoundedBox args={[1.02, 0.18, 0.015]} radius={0.032} smoothness={4}>
                            <meshStandardMaterial color="#12202b" transparent opacity={0.92} />
                        </RoundedBox>
                        <mesh position={[-0.47, 0, 0.012]}>
                            <boxGeometry args={[0.025, 0.11, 0.01]} />
                            <meshStandardMaterial color="#f59e0b" />
                        </mesh>
                        <Text
                            position={[-0.16, 0.04, 0.02]}
                            fontSize={0.029}
                            maxWidth={0.72}
                            lineHeight={1.02}
                            textAlign="left"
                            anchorX="left"
                            anchorY="middle"
                            color="#f8fafc"
                        >
                            {activeIssue.title}
                        </Text>
                        <Text
                            position={[-0.16, -0.03, 0.02]}
                            fontSize={0.022}
                            maxWidth={0.72}
                            lineHeight={1.04}
                            textAlign="left"
                            anchorX="left"
                            anchorY="middle"
                            color="#c8d6e3"
                        >
                            {activeIssue.detail}
                        </Text>

                        {reviewItems.length > 1 && (
                            <>
                                <group position={[-0.33, -0.2, 0.03]}>
                                    <RoundedBox ref={prevButtonRef} args={[0.16, 0.1, 0.03]} radius={0.03} smoothness={4}>
                                        <meshStandardMaterial ref={prevMaterial} color="#26333d" transparent opacity={0.88} />
                                    </RoundedBox>
                                    <Text position={[0, 0, 0.03]} fontSize={0.05} anchorX="center" anchorY="middle" color="#e2e8f0">
                                        ‹
                                    </Text>
                                </group>

                                <Text
                                    position={[0, -0.2, 0.035]}
                                    fontSize={0.026}
                                    maxWidth={0.28}
                                    anchorX="center"
                                    anchorY="middle"
                                    textAlign="center"
                                    color="#94a3b8"
                                >
                                    {Math.min(currentIssueIndex + 1, reviewItems.length)} / {reviewItems.length}
                                </Text>

                                <group position={[0.33, -0.2, 0.03]}>
                                    <RoundedBox ref={nextButtonRef} args={[0.16, 0.1, 0.03]} radius={0.03} smoothness={4}>
                                        <meshStandardMaterial ref={nextMaterial} color="#26333d" transparent opacity={0.88} />
                                    </RoundedBox>
                                    <Text position={[0, 0, 0.03]} fontSize={0.05} anchorX="center" anchorY="middle" color="#e2e8f0">
                                        ›
                                    </Text>
                                </group>
                            </>
                        )}
                    </group>
                ) : (
                    <RoundedBox args={[1.0, 0.16, 0.015]} radius={0.04} smoothness={4} position={[0, -0.12, 0.03]}>
                        <meshStandardMaterial color="#143122" transparent opacity={0.82} />
                    </RoundedBox>
                )}

                {reviewItems.length === 0 && (
                    <Text
                        position={[0, -0.12, 0.05]}
                        fontSize={0.034}
                        maxWidth={0.82}
                        lineHeight={1.1}
                        textAlign="center"
                        anchorX="center"
                        anchorY="middle"
                        color="#bbf7d0"
                    >
                        No detectable issues this attempt.
                    </Text>
                )}

                <group position={[-0.27, -0.46, 0.04]}>
                    <RoundedBox ref={retryButtonRef} args={[BUTTON_WIDTH, BUTTON_HEIGHT, 0.05]} radius={0.05} smoothness={5}>
                        <meshStandardMaterial ref={retryMaterial} color="#22c55e" transparent opacity={0.96} />
                    </RoundedBox>
                    <Text position={[0, 0, 0.04]} fontSize={0.045} maxWidth={0.34} anchorX="center" anchorY="middle" textAlign="center" color="#04130a">
                        Try Again
                    </Text>
                </group>

                <group position={[0.27, -0.46, 0.04]}>
                    <RoundedBox ref={closeButtonRef} args={[BUTTON_WIDTH, BUTTON_HEIGHT, 0.05]} radius={0.05} smoothness={5}>
                        <meshStandardMaterial ref={closeMaterial} color="#374550" transparent opacity={0.9} />
                    </RoundedBox>
                    <Text position={[0, 0, 0.04]} fontSize={0.045} maxWidth={0.34} anchorX="center" anchorY="middle" textAlign="center" color="#e2e8f0">
                        Close Review
                    </Text>
                </group>
            </group>
        </group>
    )
}
