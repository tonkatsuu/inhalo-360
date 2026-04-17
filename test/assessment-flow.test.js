import test from 'node:test'
import assert from 'node:assert/strict'
import { useTrainingStore, getVisibleTrainingSteps } from '../src/store/useTrainingStore.js'
import { buildAssessmentResults } from '../src/training/assessment.js'

function buildFrame(overrides = {}) {
    return {
        deltaMs: 120,
        inputMode: 'desktop',
        shakeSpeed: 0,
        uprightScore: 0,
        headTilt: 0,
        mouthDistance: 1,
        inhaleActive: false,
        breathOutActive: false,
        holdBreathActive: false,
        stabilityScore: 1,
        inhalerPosition: null,
        mouthTargetPosition: null,
        isXR: false,
        ...overrides,
    }
}

function resetStore() {
    useTrainingStore.getState().resetTrainingSession()
}

test('assessment mode holds progression until narration is confirmed', () => {
    resetStore()
    useTrainingStore.getState().setAssessmentRequireSpeech(true)
    useTrainingStore.getState().startTraining('assessment')

    for (let index = 0; index < 8; index += 1) {
        useTrainingStore.getState().syncTrainingInput(buildFrame({ shakeSpeed: 1.2 }))
    }

    let state = useTrainingStore.getState()
    assert.equal(state.currentStepId, 'shake_initial')
    assert.equal(state.sessionPhase, 'awaitingNarration')
    assert.equal(state.stepProgress, 1)
    assert.equal(state.completedSteps.length, 0)

    state.markAssessmentSpeech('shake_initial', 'I am shaking the inhaler now')

    state = useTrainingStore.getState()
    assert.equal(state.completedSteps.includes('shake_initial'), true)
    assert.equal(state.currentStepId, 'remove_cap')
    assert.equal(state.assessmentChecklist.find((item) => item.stepId === 'shake_initial')?.speechConfirmed, true)

    resetStore()
})

test('ending assessment early records physical completion without narration', () => {
    resetStore()
    useTrainingStore.getState().setAssessmentRequireSpeech(true)
    useTrainingStore.getState().startTraining('assessment')

    for (let index = 0; index < 8; index += 1) {
        useTrainingStore.getState().syncTrainingInput(buildFrame({ shakeSpeed: 1.2 }))
    }

    useTrainingStore.getState().finishAssessment()

    const state = useTrainingStore.getState()
    const results = buildAssessmentResults(state.assessmentChecklist, getVisibleTrainingSteps(state.secondDoseChoice))

    assert.equal(state.sessionPhase, 'completed')
    assert.equal(results.completedCount, 1)
    assert.equal(results.speechMisses.includes('Shake inhaler'), true)
    assert.equal(results.stepBreakdown.find((step) => step.stepId === 'shake_initial')?.status, 'completed_without_narration')

    resetStore()
})

test('assessment mode defaults to action-only progression', () => {
    resetStore()
    useTrainingStore.getState().setAssessmentRequireSpeech(false)
    useTrainingStore.getState().startTraining('assessment')

    for (let index = 0; index < 8; index += 1) {
        useTrainingStore.getState().syncTrainingInput(buildFrame({ shakeSpeed: 1.2 }))
    }

    const state = useTrainingStore.getState()
    assert.equal(state.currentStepId, 'remove_cap')
    assert.equal(state.completedSteps.includes('shake_initial'), true)
    assert.equal(state.assessmentChecklist.find((item) => item.stepId === 'shake_initial')?.speechConfirmed, true)

    resetStore()
})
