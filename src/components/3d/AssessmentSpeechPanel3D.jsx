import { RoundedBox, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { TRAINING_STEPS, getStepById, useTrainingStore } from '../../store/useTrainingStore'
import { getStepSpeechKeywords } from '../../training/assessment'
import { faceCameraUpright } from './faceCameraUpright'

const DEFAULT_POSITION = [-1.55, 1.62, -1.05]
const PANEL_WIDTH = 1.18
const PANEL_HEIGHT = 1.16

function clampTranscript(text, maxLength = 140) {
    const normalized = typeof text === 'string' ? text.trim().replace(/\s+/g, ' ') : ''
    if (!normalized) {
        return 'Listening for narration...'
    }

    if (normalized.length <= maxLength) {
        return normalized
    }

    return `${normalized.slice(0, maxLength - 1).trimEnd()}...`
}

function buildKeywordReferenceText() {
    return TRAINING_STEPS.map((step) => (
        `${step.shortLabel}: ${getStepSpeechKeywords(step.id).join(', ')}`
    )).join('\n')
}

export function AssessmentSpeechPanel3D({ position = DEFAULT_POSITION }) {
    const root = useRef()
    const glassMat = useRef()
    const borderMat = useRef()
    const camera = useThree((state) => state.camera)
    const anchorPosition = useMemo(() => new THREE.Vector3().fromArray(position), [position])
    const keywordReference = useMemo(() => buildKeywordReferenceText(), [])

    const {
        assessmentListening,
        assessmentSpeechStatus,
        assessmentSpeechError,
        assessmentSpeechSupported,
        assessmentTranscript,
        currentStepId,
        hasReviewOpen,
        sessionPhase,
        trainingMode,
    } = useTrainingStore()

    const isVisible =
        trainingMode === 'assessment' &&
        sessionPhase !== 'idle' &&
        !(sessionPhase === 'completed' && hasReviewOpen)

    const currentStep = getStepById(currentStepId)
    const currentKeywords = getStepSpeechKeywords(currentStepId).join(', ') || 'No keywords configured'
    const transcriptText = assessmentSpeechSupported
        ? clampTranscript(assessmentTranscript)
        : 'Speech recognition is not available in this browser.'
    const speechStatus = !assessmentSpeechSupported
        ? 'Unsupported'
        : assessmentSpeechStatus === 'starting'
            ? 'Starting hot mic'
        : assessmentSpeechError === 'not-allowed' || assessmentSpeechError === 'service-not-allowed'
            ? 'Permission needed'
        : assessmentSpeechError === 'audio-capture'
                ? 'Mic unavailable'
                : assessmentListening
                    ? 'Hot mic active'
                    : 'Idle'
    const guidanceText = !assessmentSpeechSupported
        ? 'This browser does not support the Web Speech API used for assessment narration.'
        : assessmentSpeechStatus === 'starting'
            ? 'Assessment narration is hot mic. The browser is trying to start microphone capture now.'
        : assessmentSpeechError === 'not-allowed' || assessmentSpeechError === 'service-not-allowed'
            ? 'Assessment narration is hot mic. Allow browser microphone access to begin transcription.'
        : assessmentSpeechError === 'audio-capture'
                ? 'Assessment narration is hot mic, but no microphone input is reaching the browser.'
                : 'Assessment narration is hot mic. There is no hold-to-talk button in this mode.'

    useFrame((_state, delta) => {
        if (!root.current || !isVisible) {
            return
        }

        root.current.position.copy(anchorPosition)
        faceCameraUpright(root.current, camera, { slerpAlpha: Math.min(1, delta * 6) })

        if (glassMat.current) {
            glassMat.current.opacity = 0.9
        }

        if (borderMat.current) {
            borderMat.current.opacity = 0.72
        }
    })

    if (!isVisible) {
        return null
    }

    return (
        <group ref={root}>
            <RoundedBox
                args={[PANEL_WIDTH + 0.05, PANEL_HEIGHT + 0.05, 0.02]}
                radius={0.045}
                smoothness={5}
                position={[0, 0, -0.01]}
            >
                <meshStandardMaterial ref={borderMat} color="#3b6a80" transparent opacity={0.72} />
            </RoundedBox>

            <RoundedBox args={[PANEL_WIDTH, PANEL_HEIGHT, 0.02]} radius={0.04} smoothness={5}>
                <meshStandardMaterial
                    ref={glassMat}
                    color="#0a151e"
                    transparent
                    opacity={0.9}
                    roughness={0.88}
                    metalness={0.02}
                />
            </RoundedBox>

            <Text
                position={[0, 0.5, 0.02]}
                fontSize={0.034}
                maxWidth={0.98}
                textAlign="center"
                anchorX="center"
                anchorY="middle"
                color="#7ec8e3"
                letterSpacing={0.08}
            >
                {'ASSESSMENT SPEECH'}
            </Text>

            <Text
                position={[0, 0.43, 0.02]}
                fontSize={0.023}
                maxWidth={0.98}
                lineHeight={1.2}
                textAlign="center"
                anchorX="center"
                anchorY="top"
                color={assessmentListening ? '#f0f9ff' : '#b4d5e5'}
            >
                {`Recognized: ${transcriptText}`}
            </Text>

            <Text
                position={[0, 0.31, 0.02]}
                fontSize={0.021}
                maxWidth={0.98}
                lineHeight={1.2}
                textAlign="center"
                anchorX="center"
                anchorY="top"
                color="#9fd4e7"
            >
                {`Mic mode: ${speechStatus}\n${guidanceText}`}
            </Text>

            <Text
                position={[0, 0.14, 0.02]}
                fontSize={0.022}
                maxWidth={0.98}
                lineHeight={1.2}
                textAlign="center"
                anchorX="center"
                anchorY="top"
                color="#d7eef8"
            >
                {`Current step: ${currentStep?.shortLabel ?? 'No active step'}\nPass keywords: ${currentKeywords}`}
            </Text>

            <Text
                position={[0, -0.08, 0.02]}
                fontSize={0.0175}
                maxWidth={1.02}
                lineHeight={1.18}
                textAlign="left"
                anchorX="center"
                anchorY="top"
                color="#b4d5e5"
            >
                {`All keyword checks\n${keywordReference}`}
            </Text>
        </group>
    )
}
