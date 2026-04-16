import { RoundedBox, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { useCallback, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useTrainingStore } from '../../store/useTrainingStore'
import { isSessionRunning } from '../../training/engine'
import { useHoverSelectAction } from './useHoverSelectAction'
import { useXRHardwareState } from './useXRHardwareState'

const WIDTH = 0.38
const HEIGHT = 0.1
const DEPTH = 0.025
const BRANCH_OFFSET_X = -0.78
const BRANCH_OFFSET_Y = -0.02
const BRANCH_OFFSET_Z = 0.02
const HUD_DISTANCE = 1.25
const HUD_FOLLOW_SPEED = 5
const HUD_VERTICAL_OFFSET = -0.04

export function AssessmentEndPanel3D(props) {
    const { trainingMode, sessionPhase, currentStepId, finishAssessment } = useTrainingStore()
    const [hovered, setHovered] = useState(false)
    const hoverRef = useRef(false)
    const root = useRef()
    const buttonRef = useRef()
    const camera = useThree((state) => state.camera)
    const raycaster = useRef(new THREE.Raycaster())
    const direction = useRef(new THREE.Vector3())
    const lookTarget = useRef(new THREE.Vector3())
    const controllerRayPos = useMemo(() => new THREE.Vector3(), [])
    const controllerDir = useMemo(() => new THREE.Vector3(), [])
    const forward = useMemo(() => new THREE.Vector3(), [])
    const hudTarget = useMemo(() => new THREE.Vector3(), [])
    const tempUp = useMemo(() => new THREE.Vector3(), [])

    const xrMode = useXR((state) => state.mode)
    const { activePointerSource } = useXRHardwareState()

    const isVisible = trainingMode === 'assessment' && isSessionRunning(sessionPhase)
    const shouldAvoidBranchPanel = sessionPhase === 'branching' && currentStepId === 'second_dose_decision'

    useFrame((_state, delta) => {
        if (!root.current) return
        if (!isVisible) {
            hoverRef.current = false
            if (hovered) {
                setHovered(false)
            }
            return
        }

        if (xrMode === 'immersive-vr') {
            camera.getWorldPosition(lookTarget.current)
            camera.getWorldDirection(forward)
            tempUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize()

            hudTarget
                .copy(lookTarget.current)
                .add(forward.clone().multiplyScalar(HUD_DISTANCE))
                .add(tempUp.multiplyScalar(HUD_VERTICAL_OFFSET))

            if (root.current.parent) {
                root.current.parent.worldToLocal(hudTarget)
                root.current.position.lerp(hudTarget, Math.min(1, delta * HUD_FOLLOW_SPEED))
            } else {
                root.current.position.lerp(hudTarget, Math.min(1, delta * HUD_FOLLOW_SPEED))
            }
        } else {
            root.current.position.x = THREE.MathUtils.damp(
                root.current.position.x,
                shouldAvoidBranchPanel ? BRANCH_OFFSET_X : 0,
                8,
                delta,
            )
            root.current.position.y = THREE.MathUtils.damp(
                root.current.position.y,
                shouldAvoidBranchPanel ? BRANCH_OFFSET_Y : 0,
                8,
                delta,
            )
            root.current.position.z = THREE.MathUtils.damp(
                root.current.position.z,
                shouldAvoidBranchPanel ? BRANCH_OFFSET_Z : 0,
                8,
                delta,
            )
        }

        camera.getWorldPosition(lookTarget.current)
        if (root.current.parent) {
            root.current.parent.worldToLocal(lookTarget.current)
        }
        root.current.lookAt(lookTarget.current)

        if (xrMode === 'immersive-vr' && activePointerSource?.object) {
            activePointerSource.object.updateWorldMatrix(true, false)
            activePointerSource.object.getWorldPosition(controllerRayPos)
            controllerDir.set(0, 0, -1).applyQuaternion(activePointerSource.object.quaternion)
            raycaster.current.set(controllerRayPos, controllerDir)
        } else {
            camera.getWorldDirection(direction.current)
            raycaster.current.set(camera.position, direction.current)
        }

        if (buttonRef.current) {
            const intersects = raycaster.current.intersectObject(buttonRef.current, true)
            const isHovered = intersects.length > 0
            hoverRef.current = isHovered
            if (isHovered !== hovered) {
                setHovered(isHovered)
            }
        }
    })

    const handleClick = useCallback(() => {
        if (isVisible) {
            finishAssessment()
        }
    }, [isVisible, finishAssessment])

    const hoverHandlers = useMemo(() => ({
        true: handleClick,
    }), [handleClick])

    useHoverSelectAction(isVisible, hoverRef, hoverHandlers)

    if (!isVisible) return null

    return (
        <group {...props}>
            <group ref={root}>
                <RoundedBox
                    ref={buttonRef}
                    args={[WIDTH, HEIGHT, DEPTH]}
                    radius={0.03}
                    onClick={handleClick}
                >
                    <meshStandardMaterial
                        color={hovered ? '#ef4444' : '#b91c1c'}
                        transparent
                        opacity={0.9}
                    />
                </RoundedBox>
                <Text
                    position={[0, 0, 0.02]}
                    fontSize={0.026}
                    color="#ffffff"
                    anchorX="center"
                    anchorY="middle"
                >
                    End Assessment
                </Text>
            </group>
        </group>
    )
}
