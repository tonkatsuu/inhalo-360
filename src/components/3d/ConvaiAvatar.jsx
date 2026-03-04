import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useConvaiRuntime } from '../../convai/useConvaiRuntime'

const AVATAR_MODEL_URL =
    'https://models.readyplayer.me/661feb3563b4a87a148eb0df.glb?morphTargets=ARKit,Oculus%20Visemes'

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

function applyIdlePose(nodes, elapsedTime) {
    if (nodes.RightArm) {
        nodes.RightArm.rotation.x = 1.1 + Math.sin(elapsedTime * 1.5) * 0.01
        nodes.RightArm.rotation.y = 0.2
        nodes.RightArm.rotation.z = -0.1 + Math.sin(elapsedTime * 1.5) * 0.02
    }

    if (nodes.LeftArm) {
        nodes.LeftArm.rotation.x = 1.1 + Math.sin(elapsedTime * 1.5 + Math.PI) * 0.01
        nodes.LeftArm.rotation.y = -0.2
        nodes.LeftArm.rotation.z = 0.1 + Math.sin(elapsedTime * 1.5 + Math.PI) * 0.02
    }

    if (nodes.RightForeArm) {
        nodes.RightForeArm.rotation.x = 0.3
        nodes.RightForeArm.rotation.z = 0
    }

    if (nodes.LeftForeArm) {
        nodes.LeftForeArm.rotation.x = 0.3
        nodes.LeftForeArm.rotation.z = 0
    }

    if (nodes.Spine) {
        nodes.Spine.rotation.x = Math.sin(elapsedTime * 2) * 0.02
        nodes.Spine.rotation.y = Math.sin(elapsedTime) * 0.02
    }

    if (nodes.Head) {
        nodes.Head.rotation.y = Math.sin(elapsedTime * 0.5) * 0.05
        nodes.Head.rotation.x = Math.sin(elapsedTime * 0.8) * 0.02
    }
}

function applySpeakingPose(nodes, elapsedTime) {
    const speakActivity = Math.sin(elapsedTime * 6) * 0.1

    if (nodes.Spine) {
        nodes.Spine.rotation.x += speakActivity * 0.5
    }

    if (nodes.Head) {
        nodes.Head.rotation.x += speakActivity * 0.3
    }

    if (nodes.RightArm && nodes.RightForeArm) {
        nodes.RightArm.rotation.x -= Math.max(0, Math.sin(elapsedTime * 4) * 0.3)
        nodes.RightArm.rotation.z += Math.sin(elapsedTime * 3) * 0.1
        nodes.RightForeArm.rotation.z += Math.sin(elapsedTime * 4) * 0.3
    }

    if (nodes.LeftArm && nodes.LeftForeArm) {
        nodes.LeftArm.rotation.x -= Math.max(0, Math.sin(elapsedTime * 5) * 0.25)
        nodes.LeftArm.rotation.z -= Math.sin(elapsedTime * 3.5) * 0.1
        nodes.LeftForeArm.rotation.z -= Math.sin(elapsedTime * 5) * 0.3
    }
}

function resetMorphTargets(nodes) {
    Object.values(nodes).forEach((node) => {
        if (node.morphTargetInfluences) {
            node.morphTargetInfluences.fill(0)
        }
    })
}

export function ConvaiAvatar(props) {
    const { client, state, isConfigured } = useConvaiRuntime()
    const { nodes, materials } = useGLTF(AVATAR_MODEL_URL)
    const speakingTime = useRef(0)

    useFrame((frameState, delta) => {
        const elapsedTime = frameState.clock.getElapsedTime()

        applyIdlePose(nodes, elapsedTime)

        if (!isConfigured || !state?.isSpeaking) {
            speakingTime.current = 0
            resetMorphTargets(nodes)
            return
        }

        applySpeakingPose(nodes, elapsedTime)

        speakingTime.current += delta
        const frameData = client?.blendshapeQueue?.getFrameAtTime(speakingTime.current)

        if (!frameData?.frame) {
            return
        }

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
    })

    return (
        <group {...props} dispose={null}>
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
                        castShadow
                        receiveShadow
                    />
                ) : null,
            )}
        </group>
    )
}

useGLTF.preload(AVATAR_MODEL_URL)
