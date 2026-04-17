import test from 'node:test'
import assert from 'node:assert/strict'
import { matchStepSpeech, buildAssessmentResults, getStepSpeechKeywords } from '../src/training/assessment.js'

test('matchStepSpeech should return true for correct keywords', () => {
    assert.equal(matchStepSpeech('i am shaking the inhaler', 'shake_initial'), true)
    assert.equal(matchStepSpeech('remove cap', 'remove_cap'), true)
    assert.equal(matchStepSpeech('random words', 'shake_initial'), false)
    assert.equal(matchStepSpeech('', 'shake_initial'), false)
})

test('getStepSpeechKeywords should expose keyword lists for each step', () => {
    assert.deepEqual(getStepSpeechKeywords('shake_initial'), ['shake', 'shaking', 'mix', 'mixing', 'agitate'])
    assert.deepEqual(getStepSpeechKeywords('unknown_step'), [])
})

test('buildAssessmentResults should calculate correct scores and reports', () => {
    const allSteps = [
        { id: 'step1', shortLabel: 'Step 1' },
        { id: 'step2', shortLabel: 'Step 2' },
        { id: 'step3', shortLabel: 'Step 3' },
    ]

    const checklist = [
        { stepId: 'step1', physicalComplete: true, speechConfirmed: true },
        { stepId: 'step2', physicalComplete: true, speechConfirmed: false },
    ]

    const results = buildAssessmentResults(checklist, allSteps)

    assert.equal(results.score < 100, true)
    assert.equal(results.completedCount, 2)
    assert.equal(results.completedInSequence, true)
    assert.equal(results.missedSteps.length, 1)
    assert.equal(results.missedSteps[0], 'Step 3')
    assert.equal(results.speechMisses.includes('Step 2'), true)
    assert.equal(results.stepBreakdown.find((step) => step.stepId === 'step2')?.status, 'completed_without_narration')
})

test('buildAssessmentResults should detect out-of-order steps', () => {
    const allSteps = [
        { id: '1', shortLabel: '1' },
        { id: '2', shortLabel: '2' },
    ]

    const checklist = [
        { stepId: '2', physicalComplete: true, speechConfirmed: true },
        { stepId: '1', physicalComplete: true, speechConfirmed: true },
    ]

    const results = buildAssessmentResults(checklist, allSteps)
    assert.equal(results.outOfOrderSteps.includes('1'), true)
    assert.equal(results.score < 100, true)
})
