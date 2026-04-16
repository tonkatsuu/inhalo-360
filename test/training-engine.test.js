import test from 'node:test'
import assert from 'node:assert/strict'
import {
    createStepRuntime,
    evaluateTrainingStep,
    getNextStepId,
    getStepById,
    getVisibleTrainingSteps,
} from '../src/training/engine.js'

function buildFrame(overrides = {}) {
    return {
        deltaMs: 100,
        shakeSpeed: 0,
        uprightScore: 0,
        headTilt: 0,
        mouthDistance: 1,
        inhaleActive: false,
        breathOutActive: false,
        holdBreathActive: false,
        stabilityScore: 1,
        ...overrides,
    }
}

test('shake validator only succeeds after enough motion duration', () => {
    const step = getStepById('shake_initial')
    let runtime = createStepRuntime(step)
    let outcome = null

    for (let index = 0; index < 7; index += 1) {
        outcome = evaluateTrainingStep({
            step,
            runtime,
            frame: buildFrame({ deltaMs: 120, shakeSpeed: 1.24 }),
            action: null,
        })
        runtime = outcome.runtime
    }

    assert.notEqual(outcome.status, 'success')

    outcome = evaluateTrainingStep({
        step,
        runtime,
        frame: buildFrame({ deltaMs: 120, shakeSpeed: 1.24 }),
        action: null,
    })

    assert.equal(outcome.status, 'success')
    assert.equal(outcome.progress, 1)
})

test('inhale-press validator rejects early press and accepts correct inhale timing', () => {
    const step = getStepById('inhale_press')
    let runtime = createStepRuntime(step)

    let outcome = evaluateTrainingStep({
        step,
        runtime,
        frame: buildFrame({ deltaMs: 100, mouthDistance: 0.12, uprightScore: 0.9, inhaleActive: false }),
        action: { type: 'press-canister', timestamp: 1000 },
    })

    assert.equal(outcome.status, 'feedback')
    assert.equal(outcome.feedback.code, 'press_without_inhale')

    runtime = createStepRuntime(step)
    for (let index = 0; index < 6; index += 1) {
        outcome = evaluateTrainingStep({
            step,
            runtime,
            frame: buildFrame({ deltaMs: 100, mouthDistance: 0.12, uprightScore: 0.9, inhaleActive: true }),
            action: null,
        })
        runtime = outcome.runtime
    }

    outcome = evaluateTrainingStep({
        step,
        runtime,
        frame: buildFrame({ deltaMs: 100, mouthDistance: 0.12, uprightScore: 0.9, inhaleActive: true }),
        action: { type: 'press-canister', timestamp: 1700 },
    })
    runtime = outcome.runtime
    assert.equal(outcome.status, 'validating')

    for (let index = 0; index < 8; index += 1) {
        outcome = evaluateTrainingStep({
            step,
            runtime,
            frame: buildFrame({ deltaMs: 100, mouthDistance: 0.12, uprightScore: 0.9, inhaleActive: true }),
            action: null,
        })
        runtime = outcome.runtime
    }

    assert.equal(outcome.status, 'success')
})

test('branch step requires exhale before it allows the second-dose choice', () => {
    const step = getStepById('second_dose_decision')
    let runtime = createStepRuntime(step)

    let outcome = evaluateTrainingStep({
        step,
        runtime,
        frame: buildFrame({ deltaMs: 100, breathOutActive: false, mouthDistance: 0.4 }),
        action: { type: 'branch-choice', choice: true },
    })

    assert.equal(outcome.status, 'feedback')
    assert.equal(outcome.feedback.code, 'branch_before_exhale')

    runtime = createStepRuntime(step)
    for (let index = 0; index < 9; index += 1) {
        outcome = evaluateTrainingStep({
            step,
            runtime,
            frame: buildFrame({ deltaMs: 100, breathOutActive: true, mouthDistance: 0.4 }),
            action: null,
        })
        runtime = outcome.runtime
    }

    assert.equal(outcome.status, 'branching')

    outcome = evaluateTrainingStep({
        step,
        runtime: outcome.runtime,
        frame: buildFrame({ deltaMs: 100, breathOutActive: true, mouthDistance: 0.4 }),
        action: { type: 'branch-choice', choice: true },
    })

    assert.equal(outcome.status, 'success')
    assert.equal(outcome.branchChoice, true)
})

test('branch-aware step visibility and next-step resolution exclude second dose when skipped', () => {
    const skippedSteps = getVisibleTrainingSteps(false).map((step) => step.id)
    const repeatedDoseSteps = getVisibleTrainingSteps(true).map((step) => step.id)

    assert.equal(skippedSteps.includes('second_dose_shake'), false)
    assert.equal(repeatedDoseSteps.includes('second_dose_shake'), true)
    assert.equal(getNextStepId('second_dose_decision', false), 'replace_cap')
    assert.equal(getNextStepId('second_dose_decision', true), 'second_dose_shake')
})
