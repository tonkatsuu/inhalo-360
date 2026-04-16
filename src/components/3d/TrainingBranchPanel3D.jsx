import { RoundedBox, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useXR, useXRInputSourceState } from '@react-three/xr'
import { useCallback, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useTrainingStore } from '../../store/useTrainingStore'
import { BrandChip3D } from './BrandChip3D'
import { useHoverSelectAction } from './useHoverSelectAction'

const PANEL_WIDTH = 1.05
const PANEL_HEIGHT = 0.58
const PANEL_DEPTH = 0.04
const BUTTON_WIDTH = 0.34
const BUTTON_HEIGHT = 0.16

export function TrainingBranchPanel3D(props) {
    const root = useRef()
    const yesButtonRef = useRef()
    const noButtonRef = useRef()
    const glassMaterial = useRef()
    const borderMaterial = useRef()
    const yesMaterial = useRef()
    const noMaterial = useRef()
    const hoverRef = useRef(null)
    const fadeRef = useRef(0)
    const [hoveredButton, setHoveredButton] = useState(null)

    const camera = useThree((state) => state.camera)
    const raycaster = useMemo(() => new THREE.Raycaster(), [])
    const forward = useMemo(() => new THREE.Vector3(), [])
    const lookTarget = useMemo(() => new THREE.Vector3(), [])
    const controllerDir = useMemo(() => new THREE.Vector3(), [])
    const controllerPos = useMemo(() => new THREE.Vector3(), [])

    const xrMode = useXR((state) => state.mode)
    const rightController = useXRInputSourceState('controller', 'right')
    const leftController = useXRInputSourceState('controller', 'left')
    const activeController = rightController ?? leftController

    const { currentStepId, dispatchTrainingAction, sessionPhase } = useTrainingStore()
    const isVisible = sessionPhase === 'branching' && currentStepId === 'second_dose_decision'

    const chooseYes = useCallback(() => {
        dispatchTrainingAction({ type: 'branch-choice', choice: true })
    }, [dispatchTrainingAction])

    const chooseNo = useCallback(() => {
        dispatchTrainingAction({ type: 'branch-choice', choice: false })
    }, [dispatchTrainingAction])

    const hoverHandlers = useMemo(() => ({
        yes: chooseYes,
        no: chooseNo,
    }), [chooseNo, chooseYes])

    useHoverSelectAction(isVisible, hoverRef, hoverHandlers)

    useFrame((_state, delta) => {
        if (!root.current) {
            return
        }

        fadeRef.current = THREE.MathUtils.damp(fadeRef.current, 1, 10, delta)
        const opacity = fadeRef.current

        root.current.scale.setScalar(0.92 + opacity * 0.08)
        lookTarget.copy(camera.position)
        root.current.lookAt(lookTarget)

        // In XR mode, raycast from the controller; on desktop, use camera gaze
        if (xrMode === 'immersive-vr' && activeController?.object) {
            activeController.object.updateWorldMatrix(true, false)
            activeController.object.getWorldPosition(controllerPos)
            controllerDir.set(0, 0, -1).applyQuaternion(activeController.object.quaternion)
            raycaster.set(controllerPos, controllerDir)
        } else {
            camera.getWorldDirection(forward)
            raycaster.set(camera.position, forward)
        }

        let nextHover = null
        if (yesButtonRef.current && raycaster.intersectObject(yesButtonRef.current, true).length > 0) {
            nextHover = 'yes'
        } else if (noButtonRef.current && raycaster.intersectObject(noButtonRef.current, true).length > 0) {
            nextHover = 'no'
        }

        hoverRef.current = nextHover
        if (nextHover !== hoveredButton) {
            setHoveredButton(nextHover)
        }

        if (glassMaterial.current) {
            glassMaterial.current.opacity = 0.94 * opacity
        }
        if (borderMaterial.current) {
            borderMaterial.current.opacity = 0.72 * opacity
        }
        if (yesMaterial.current) {
            yesMaterial.current.color.set(hoveredButton === 'yes' ? '#34d399' : '#22c55e')
            yesMaterial.current.opacity = 0.96 * opacity
        }
        if (noMaterial.current) {
            noMaterial.current.color.set(hoveredButton === 'no' ? '#f59e0b' : '#d97706')
            noMaterial.current.opacity = 0.96 * opacity
        }
    })

    if (!isVisible) {
        return null
    }

    return (
        <group {...props}>
            <group ref={root}>
                <RoundedBox args={[PANEL_WIDTH + 0.06, PANEL_HEIGHT + 0.06, PANEL_DEPTH]} radius={0.06} smoothness={5} position={[0, 0, -0.02]}>
                    <meshStandardMaterial ref={borderMaterial} color="#457084" transparent opacity={0.72} />
                </RoundedBox>

                <RoundedBox args={[PANEL_WIDTH, PANEL_HEIGHT, PANEL_DEPTH]} radius={0.055} smoothness={5}>
                    <meshStandardMaterial ref={glassMaterial} color="#09131b" transparent opacity={0.94} roughness={0.92} metalness={0.02} />
                </RoundedBox>

                <BrandChip3D position={[-0.12, 0.225, 0.03]} width={0.58} />

                <Text
                    position={[0, 0.09, 0.04]}
                    fontSize={0.052}
                    maxWidth={0.82}
                    textAlign="center"
                    anchorX="center"
                    anchorY="middle"
                    color="#f8fafc"
                >
                    Is a second dose needed?
                </Text>

                <Text
                    position={[0, -0.04, 0.04]}
                    fontSize={0.034}
                    maxWidth={0.82}
                    textAlign="center"
                    anchorX="center"
                    anchorY="middle"
                    color="#c8d6e3"
                >
                    Choose based on the prescription you want to rehearse.
                </Text>

                <group position={[-0.22, -0.17, 0.04]}>
                    <RoundedBox ref={yesButtonRef} args={[BUTTON_WIDTH, BUTTON_HEIGHT, 0.04]} radius={0.04} smoothness={5} onClick={chooseYes}>
                        <meshStandardMaterial ref={yesMaterial} color="#22c55e" transparent opacity={0.96} />
                    </RoundedBox>
                    <Text position={[0, 0, 0.04]} fontSize={0.05} anchorX="center" anchorY="middle" color="#03230f">
                        Yes
                    </Text>
                </group>

                <group position={[0.22, -0.17, 0.04]}>
                    <RoundedBox ref={noButtonRef} args={[BUTTON_WIDTH, BUTTON_HEIGHT, 0.04]} radius={0.04} smoothness={5} onClick={chooseNo}>
                        <meshStandardMaterial ref={noMaterial} color="#d97706" transparent opacity={0.96} />
                    </RoundedBox>
                    <Text position={[0, 0, 0.04]} fontSize={0.05} anchorX="center" anchorY="middle" color="#2a1201">
                        No
                    </Text>
                </group>
            </group>
        </group>
    )
}
