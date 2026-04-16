import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useConvaiRuntime } from '../../convai/useConvaiRuntime'
import { ConvaiSpeechBillboard } from './ConvaiSpeechBillboard'

const AVATAR_MODEL_URL =
    'https://cdn.jsdelivr.net/gh/c-frame/valid-avatars-glb@c539a28/avatars/MENA/MENA_F_1_Medi.glb'

const ARKIT_NAMES = [
    'eyeBlinkLeft', 'eyeLookDownLeft', 'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookUpLeft',
    'eyeSquintLeft', 'eyeWideLeft', 'eyeBlinkRight', 'eyeLookDownRight', 'eyeLookInRight',
    'eyeLookOutRight', 'eyeLookUpRight', 'eyeSquintRight', 'eyeWideRight', 'jawForward',
    'jawLeft', 'jawRight', 'jawOpen', 'mouthClose', 'mouthFunnel', 'mouthPucker',
    'mouthLeft', 'mouthRight', 'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft',
    'mouthFrownRight', 'mouthDimpleLeft', 'mouthDimpleRight', 'mouthStretchLeft',
    'mouthStretchRight', 'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower',
    'mouthShrugUpper', 'mouthPressLeft', 'mouthPressRight', 'mouthLowerDownLeft',
    'mouthLowerDownRight', 'mouthUpperUpLeft', 'mouthUpperUpRight', 'browDownLeft',
    'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'cheekPuff',
    'cheekSquintLeft', 'cheekSquintRight', 'noseSneerLeft', 'noseSneerRight', 'tongueOut',
]

const BONES_TO_ANIMATE = [
    'Hips', 'Spine', 'Neck', 'Head', 
    'RightArm', 'LeftArm', 'RightForeArm', 'LeftForeArm'
]

function applyIdlePose(nodes, elapsedTime, initialRotations) {
    // Subtle breathing/sway relative to initial pose
    const breathing = Math.sin(elapsedTime * 1.5) * 0.01

    if (nodes.Spine && initialRotations?.Spine) {
        nodes.Spine.rotation.x = initialRotations.Spine.x + breathing
    }

    // Lower arms naturally by adding to their base X rotation
    // Since Z moved them forward/back, X or Y must be the up/down axis for this rig
    if (nodes.RightArm && initialRotations?.RightArm) {
        nodes.RightArm.rotation.x = initialRotations.RightArm.x + 1.3
    }

    if (nodes.LeftArm && initialRotations?.LeftArm) {
        nodes.LeftArm.rotation.x = initialRotations.LeftArm.x + 1.3
    }

    // Keep head forward
    if (nodes.Head && initialRotations?.Head) {
        nodes.Head.rotation.x = initialRotations.Head.x
        nodes.Head.rotation.y = initialRotations.Head.y
    }
}

function applySpeakingPose(nodes, elapsedTime, initialRotations) {
    const speakActivity = Math.sin(elapsedTime * 6) * 0.05

    // Subtle spine/head movement while talking
    if (nodes.Spine && initialRotations?.Spine) {
        nodes.Spine.rotation.x += speakActivity
    }

    if (nodes.Head && initialRotations?.Head) {
        nodes.Head.rotation.x += speakActivity * 0.5
    }

    // Keep arms down but add subtle gesturing movements
    if (nodes.RightArm && initialRotations?.RightArm) {
        // Offset (+1.3) keeps it down, sin movements add the gesture
        nodes.RightArm.rotation.x = initialRotations.RightArm.x + 1.3 + Math.sin(elapsedTime * 3) * 0.1
        nodes.RightArm.rotation.z = initialRotations.RightArm.z + Math.sin(elapsedTime * 2) * 0.05
    }

    if (nodes.LeftArm && initialRotations?.LeftArm) {
        nodes.LeftArm.rotation.x = initialRotations.LeftArm.x + 1.3 + Math.sin(elapsedTime * 3.5) * 0.1
        nodes.LeftArm.rotation.z = initialRotations.LeftArm.z - Math.sin(elapsedTime * 2.5) * 0.05
    }
}

function resetMorphTargets(nodes) {
    Object.values(nodes).forEach((node) => {
        if (node.morphTargetInfluences) {
            node.morphTargetInfluences.fill(0)
        }
    })
}

function applyBlinking(nodes, elapsedTime) {
    const blinkCycle = elapsedTime % 4
    const isBlinking = blinkCycle > 3.8
    const blinkValue = isBlinking ? 1 : 0

    Object.values(nodes).forEach((node) => {
        if (node.morphTargetDictionary && node.morphTargetInfluences) {
            const leftIndex = node.morphTargetDictionary['eyeBlinkLeft']
            const rightIndex = node.morphTargetDictionary['eyeBlinkRight']
            if (leftIndex !== undefined) node.morphTargetInfluences[leftIndex] = blinkValue
            if (rightIndex !== undefined) node.morphTargetInfluences[rightIndex] = blinkValue
        }
    })
}

export function ConvaiAvatar(props) {
    const { client, state, isConfigured } = useConvaiRuntime()
    const { nodes, materials } = useGLTF(AVATAR_MODEL_URL)
    const speakingTime = useRef(0)
    const initialRotations = useRef(null)

    useFrame((frameState, delta) => {
        const elapsedTime = frameState.clock.getElapsedTime()

        // 0. Initialize and reset rotations to original posture
        if (!initialRotations.current && nodes.Hips) {
            initialRotations.current = {}
            Object.entries(nodes).forEach(([name, node]) => {
                if (node.rotation) {
                    initialRotations.current[name] = {
                        x: node.rotation.x,
                        y: node.rotation.y,
                        z: node.rotation.z
                    }
                }
            })
        }

        if (!initialRotations.current) return

        BONES_TO_ANIMATE.forEach(boneName => {
            const node = nodes[boneName]
            const initRot = initialRotations.current[boneName]
            if (node && initRot) {
                node.rotation.set(initRot.x, initRot.y, initRot.z)
            }
        })

        applyIdlePose(nodes, elapsedTime, initialRotations.current)

        if (!isConfigured) return

        if (!state?.isSpeaking) {
            speakingTime.current = 0
            resetMorphTargets(nodes)
        } else {
            applySpeakingPose(nodes, elapsedTime, initialRotations.current)

            speakingTime.current += delta
            const frameData = client?.blendshapeQueue?.getFrameAtTime(speakingTime.current)

            if (frameData?.frame) {
                Object.values(nodes).forEach((node) => {
                    if (!node.isMesh || !node.morphTargetDictionary || !node.morphTargetInfluences) {
                        return
                    }

                    Object.entries(node.morphTargetDictionary).forEach(([name, index]) => {
                        const frameIndex = ARKIT_NAMES.indexOf(name)
                        if (frameIndex !== -1 && frameIndex < frameData.frame.length) {
                            node.morphTargetInfluences[index] = frameData.frame[frameIndex]
                        }
                    })
                })
            }
        }

        applyBlinking(nodes, elapsedTime)
    })

    return (
        <group {...props} dispose={null}>
            <ConvaiSpeechBillboard position={[1.15, 1.35, 0.15]} />
            <primitive object={nodes.Hips} />
            {Object.values(nodes).map((node, index) =>
                node.isMesh ? (
                    <skinnedMesh
                        key={index}
                        geometry={node.geometry}
                        material={materials[node.material?.name] || node.material}
                        skeleton={node.skeleton}
                        morphTargetDictionary={node.morphTargetDictionary}
                        morphTargetInfluences={node.morphTargetInfluences}
                        raycast={() => null}
                        castShadow
                        receiveShadow
                    />
                ) : null,
            )}
        </group>
    )
}

useGLTF.preload(AVATAR_MODEL_URL)
