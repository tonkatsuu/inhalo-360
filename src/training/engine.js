const CLAMP_EPSILON = 0.0001

export const PROTOTYPE_HOLD_BREATH_MS = 4000

export const TRAINING_STEPS = [
    {
        id: 'shake_initial',
        shortLabel: 'Shake inhaler',
        instruction: 'Shake the inhaler well before the first dose.',
        validatorType: 'shake',
        requiredHoldMs: 900,
        successWindow: { minShakeSpeed: 0.85 },
        coachPrompt: 'Tell the user to shake the inhaler until the medicine is mixed and ready.',
        mistakeHints: {
            primary: 'Use a firmer side-to-side shake for a little longer.',
        },
    },
    {
        id: 'remove_cap',
        shortLabel: 'Remove cap',
        instruction: 'Remove the mouthpiece cover.',
        validatorType: 'capState',
        requiredHoldMs: 0,
        successWindow: { capOff: true },
        coachPrompt: 'Tell the user to remove the mouthpiece cover before using the inhaler.',
        mistakeHints: {
            primary: 'Take the cap off completely before moving on.',
        },
    },
    {
        id: 'hold_upright',
        shortLabel: 'Hold upright',
        instruction: 'Hold the inhaler upright and steady.',
        validatorType: 'uprightHold',
        requiredHoldMs: 1200,
        successWindow: { minUprightScore: 0.84 },
        coachPrompt: 'Tell the user to keep the inhaler upright and steady for a moment.',
        mistakeHints: {
            primary: 'Raise the inhaler so it is vertical, not tilted down.',
        },
    },
    {
        id: 'tilt_head',
        shortLabel: 'Tilt head',
        instruction: 'Tilt your head back slightly.',
        validatorType: 'headTilt',
        requiredHoldMs: 900,
        successWindow: { minHeadTilt: 0.14 },
        coachPrompt: 'Tell the user to tilt their head back slightly without overextending.',
        mistakeHints: {
            primary: 'Lift your chin just a little more.',
        },
    },
    {
        id: 'breathe_out',
        shortLabel: 'Breathe out',
        instruction: 'Breathe out gently before bringing the inhaler to your mouth.',
        validatorType: 'breathOut',
        requiredHoldMs: 900,
        successWindow: { requireAwayFromMouth: true },
        coachPrompt: 'Tell the user to breathe out gently to empty the lungs before the puff.',
        mistakeHints: {
            primary: 'Finish breathing out before you bring the inhaler in.',
        },
    },
    {
        id: 'mouth_seal',
        shortLabel: 'Seal lips',
        instruction: 'Bring the mouthpiece to your mouth and seal your lips around it.',
        validatorType: 'mouthSeal',
        requiredHoldMs: 1200,
        successWindow: { maxMouthDistance: 0.18, minUprightScore: 0.8 },
        coachPrompt: 'Tell the user to place the mouthpiece in the mouth and form a good seal with the lips.',
        mistakeHints: {
            primary: 'Bring the inhaler closer to your mouth and keep it upright.',
        },
    },
    {
        id: 'inhale_press',
        shortLabel: 'Inhale and press',
        instruction: 'Start breathing in slowly, then press the inhaler once while you continue inhaling.',
        validatorType: 'inhalePress',
        requiredHoldMs: 1100,
        successWindow: {
            maxMouthDistance: 0.18,
            minUprightScore: 0.8,
            inhaleLeadMs: 500,
            inhaleFollowMs: 700,
        },
        coachPrompt:
            'Tell the user to begin a slow breath in first, press the inhaler during that breath, and keep inhaling smoothly.',
        mistakeHints: {
            primary: 'Press once during a slow inhale, not before or after it.',
        },
    },
    {
        id: 'hold_breath',
        shortLabel: 'Hold breath',
        instruction: 'Hold your breath steadily after the puff.',
        validatorType: 'holdBreath',
        requiredHoldMs: PROTOTYPE_HOLD_BREATH_MS,
        successWindow: { minStability: 0.82 },
        coachPrompt: 'Tell the user to hold the breath steadily after the puff before breathing out.',
        mistakeHints: {
            primary: 'Stay still and keep holding your breath a little longer.',
        },
    },
    {
        id: 'second_dose_decision',
        shortLabel: 'Need second dose?',
        instruction: 'Breathe out and decide whether a second dose is needed.',
        validatorType: 'branchChoice',
        requiredHoldMs: 900,
        successWindow: { requireAwayFromMouth: true },
        coachPrompt:
            'Tell the user to breathe out, pause, and then choose whether a second prescribed puff is needed.',
        mistakeHints: {
            primary: 'Breathe out first, then choose whether to take a second dose.',
        },
        branchTarget: {
            yes: 'second_dose_shake',
            no: 'replace_cap',
        },
    },
    {
        id: 'second_dose_shake',
        shortLabel: 'Shake again',
        instruction: 'Shake the inhaler again before the second dose.',
        validatorType: 'shake',
        requiredHoldMs: 800,
        successWindow: { minShakeSpeed: 0.85 },
        coachPrompt: 'Tell the user to shake the inhaler again before the second puff.',
        mistakeHints: {
            primary: 'Shake again before the second dose.',
        },
        optional: true,
    },
    {
        id: 'second_dose_breathe_out',
        shortLabel: 'Breathe out again',
        instruction: 'Breathe out gently again before the second dose.',
        validatorType: 'breathOut',
        requiredHoldMs: 800,
        successWindow: { requireAwayFromMouth: true },
        coachPrompt: 'Tell the user to breathe out again before the second puff.',
        mistakeHints: {
            primary: 'Finish breathing out again before bringing the inhaler back to your mouth.',
        },
        optional: true,
    },
    {
        id: 'second_dose_mouth_seal',
        shortLabel: 'Seal lips again',
        instruction: 'Bring the mouthpiece back to your mouth and seal with your lips again.',
        validatorType: 'mouthSeal',
        requiredHoldMs: 900,
        successWindow: { maxMouthDistance: 0.18, minUprightScore: 0.8 },
        coachPrompt: 'Tell the user to place the mouthpiece back in the mouth and seal the lips for the second puff.',
        mistakeHints: {
            primary: 'Bring it back to your mouth and keep the seal snug for the second puff.',
        },
        optional: true,
    },
    {
        id: 'second_dose_inhale_press',
        shortLabel: 'Inhale and press again',
        instruction: 'Start breathing in slowly again, then press once for the second dose.',
        validatorType: 'inhalePress',
        requiredHoldMs: 1100,
        successWindow: {
            maxMouthDistance: 0.18,
            minUprightScore: 0.8,
            inhaleLeadMs: 500,
            inhaleFollowMs: 700,
        },
        coachPrompt: 'Tell the user to repeat the slow inhale and single press for the second puff.',
        mistakeHints: {
            primary: 'Repeat the slow inhale and press timing for the second puff.',
        },
        optional: true,
    },
    {
        id: 'second_dose_hold_breath',
        shortLabel: 'Hold breath again',
        instruction: 'Hold your breath again after the second puff.',
        validatorType: 'holdBreath',
        requiredHoldMs: PROTOTYPE_HOLD_BREATH_MS,
        successWindow: { minStability: 0.82 },
        coachPrompt: 'Tell the user to hold the breath again after the second puff before breathing out.',
        mistakeHints: {
            primary: 'Hold your breath steadily again after the second puff.',
        },
        optional: true,
    },
    {
        id: 'replace_cap',
        shortLabel: 'Replace cap',
        instruction: 'Replace the mouthpiece cover to finish.',
        validatorType: 'capState',
        requiredHoldMs: 0,
        successWindow: { capOff: false },
        coachPrompt: 'Tell the user to replace the mouthpiece cover and finish the session.',
        mistakeHints: {
            primary: 'Put the cap back on to finish safely.',
        },
    },
]

export const STEP_MAP = Object.fromEntries(TRAINING_STEPS.map((step) => [step.id, step]))
export const INITIAL_STEP_ID = TRAINING_STEPS[0].id
export const DECISION_STEP_ID = 'second_dose_decision'

export function clamp01(value) {
    return Math.max(0, Math.min(1, value))
}

export function isSessionRunning(sessionPhase) {
    return !['idle', 'starting', 'completed'].includes(sessionPhase)
}

export function getVisibleTrainingSteps(secondDoseChoice = null) {
    return TRAINING_STEPS.filter((step) => {
        if (!step.optional) return true
        return secondDoseChoice === true
    })
}

export function getStepById(stepId) {
    return STEP_MAP[stepId] ?? null
}

export function getStepIndex(stepId, secondDoseChoice = null) {
    return getVisibleTrainingSteps(secondDoseChoice).findIndex((step) => step.id === stepId)
}

export function getNextStepId(stepId, secondDoseChoice = null) {
    if (stepId === DECISION_STEP_ID) {
        if (secondDoseChoice === true) {
            return 'second_dose_shake'
        }

        if (secondDoseChoice === false) {
            return 'replace_cap'
        }

        return DECISION_STEP_ID
    }

    const currentIndex = TRAINING_STEPS.findIndex((step) => step.id === stepId)
    if (currentIndex < 0) {
        return null
    }

    for (let index = currentIndex + 1; index < TRAINING_STEPS.length; index += 1) {
        const candidate = TRAINING_STEPS[index]
        if (!candidate.optional || secondDoseChoice === true) {
            return candidate.id
        }
    }

    return null
}

export function createStepRuntime(step) {
    return {
        stepId: step.id,
        attempts: 0,
        failureCount: 0,
        progress: 0,
        accumulatedMs: 0,
        wasActive: false,
        pressActive: false,
        pressAcceptedAt: null,
        inhaleLeadMs: 0,
        inhaleFollowMs: 0,
        lastFeedbackCode: null,
        lastUpdatedAt: null,
    }
}

function buildOutcome(nextRuntime, patch = {}) {
    return {
        runtime: nextRuntime,
        progress: clamp01(nextRuntime.progress ?? 0),
        liveHint: patch.liveHint ?? null,
        status: patch.status ?? 'pending',
        feedback: patch.feedback ?? null,
        branchChoice: patch.branchChoice ?? null,
    }
}

function markActive(nextRuntime, active, deltaMs) {
    if (active) {
        if (!nextRuntime.wasActive) {
            nextRuntime.attempts += 1
            nextRuntime.wasActive = true
        }
        nextRuntime.accumulatedMs += deltaMs
        nextRuntime.lastFeedbackCode = null
    } else {
        nextRuntime.wasActive = false
        nextRuntime.accumulatedMs = 0
    }
}

function emitFailure(step, nextRuntime, code, message, correction, liveHint = correction) {
    const feedback = nextRuntime.lastFeedbackCode === code
        ? null
        : {
            code,
            message,
            correction,
        }

    if (feedback) {
        nextRuntime.failureCount += 1
        nextRuntime.attempts += 1
        nextRuntime.lastFeedbackCode = code
    }

    return buildOutcome(nextRuntime, {
        status: 'feedback',
        feedback,
        liveHint,
    })
}

function success(nextRuntime, liveHint = 'Step complete.') {
    nextRuntime.progress = 1
    nextRuntime.wasActive = false
    nextRuntime.lastFeedbackCode = null
    return buildOutcome(nextRuntime, {
        status: 'success',
        liveHint,
    })
}

function getContinuousProgress(nextRuntime, requiredHoldMs) {
    return clamp01(nextRuntime.accumulatedMs / Math.max(requiredHoldMs, CLAMP_EPSILON))
}

function evaluateShake(step, runtime, frame) {
    const nextRuntime = { ...runtime }
    const deltaMs = Math.max(0, frame?.deltaMs ?? 0)
    const shakeSpeed = frame?.shakeSpeed ?? 0
    const isActive = shakeSpeed >= (step.successWindow?.minShakeSpeed ?? 1)

    if (isActive) {
        markActive(nextRuntime, true, deltaMs)
    } else {
        nextRuntime.wasActive = false
        nextRuntime.accumulatedMs = Math.max(0, nextRuntime.accumulatedMs - deltaMs * 0.6)
    }
    nextRuntime.progress = getContinuousProgress(nextRuntime, step.requiredHoldMs)

    if (!isActive) {
        return buildOutcome(nextRuntime, {
            status: nextRuntime.progress > 0 ? 'validating' : 'awaitingAction',
            liveHint: nextRuntime.progress > 0 ? 'Keep the shake going.' : step.mistakeHints.primary,
        })
    }

    if (nextRuntime.accumulatedMs >= step.requiredHoldMs) {
        return success(nextRuntime, 'Good shake. The inhaler is ready.')
    }

    return buildOutcome(nextRuntime, {
        status: 'validating',
        liveHint: 'Keep shaking for a moment longer.',
    })
}

function evaluateCapState(step, runtime, _frame, action) {
    const nextRuntime = { ...runtime }
    const desiredCapOff = step.successWindow?.capOff === true

    if (!action) {
        return buildOutcome(nextRuntime, {
            status: 'awaitingAction',
            liveHint: step.mistakeHints.primary,
        })
    }

    if (desiredCapOff && action.type === 'remove-cap') {
        nextRuntime.attempts += 1
        return success(nextRuntime, 'Cap removed.')
    }

    if (!desiredCapOff && action.type === 'replace-cap') {
        nextRuntime.attempts += 1
        return success(nextRuntime, 'Cap replaced.')
    }

    return emitFailure(
        step,
        nextRuntime,
        'wrong_cap_action',
        `The cap action did not match the step "${step.instruction}".`,
        step.mistakeHints.primary,
    )
}

function evaluateUprightHold(step, runtime, frame) {
    const nextRuntime = { ...runtime }
    const deltaMs = Math.max(0, frame?.deltaMs ?? 0)
    const uprightScore = frame?.uprightScore ?? 0
    const isActive = uprightScore >= (step.successWindow?.minUprightScore ?? 0.8)

    markActive(nextRuntime, isActive, deltaMs)
    nextRuntime.progress = getContinuousProgress(nextRuntime, step.requiredHoldMs)

    if (!isActive) {
        return buildOutcome(nextRuntime, {
            status: nextRuntime.progress > 0 ? 'validating' : 'awaitingAction',
            liveHint: step.mistakeHints.primary,
        })
    }

    if (nextRuntime.accumulatedMs >= step.requiredHoldMs) {
        return success(nextRuntime, 'The inhaler is upright and steady.')
    }

    return buildOutcome(nextRuntime, {
        status: 'validating',
        liveHint: 'Hold the inhaler upright and steady.',
    })
}

function evaluateHeadTilt(step, runtime, frame) {
    const nextRuntime = { ...runtime }
    const deltaMs = Math.max(0, frame?.deltaMs ?? 0)
    const headTilt = frame?.headTilt ?? 0
    const isActive = headTilt >= (step.successWindow?.minHeadTilt ?? 0.12)

    markActive(nextRuntime, isActive, deltaMs)
    nextRuntime.progress = getContinuousProgress(nextRuntime, step.requiredHoldMs)

    if (!isActive) {
        return buildOutcome(nextRuntime, {
            status: nextRuntime.progress > 0 ? 'validating' : 'awaitingAction',
            liveHint: step.mistakeHints.primary,
        })
    }

    if (nextRuntime.accumulatedMs >= step.requiredHoldMs) {
        return success(nextRuntime, 'Head position looks good.')
    }

    return buildOutcome(nextRuntime, {
        status: 'validating',
        liveHint: 'Keep your head tilted back slightly.',
    })
}

function evaluateBreathOut(step, runtime, frame) {
    const nextRuntime = { ...runtime }
    const deltaMs = Math.max(0, frame?.deltaMs ?? 0)
    const isAwayFromMouth = step.successWindow?.requireAwayFromMouth !== true || (frame?.mouthDistance ?? 1) > 0.2
    const isActive = frame?.breathOutActive === true && isAwayFromMouth

    markActive(nextRuntime, isActive, deltaMs)
    nextRuntime.progress = getContinuousProgress(nextRuntime, step.requiredHoldMs)

    if (!isActive) {
        return buildOutcome(nextRuntime, {
            status: nextRuntime.progress > 0 ? 'validating' : 'awaitingAction',
            liveHint: step.mistakeHints.primary,
        })
    }

    if (nextRuntime.accumulatedMs >= step.requiredHoldMs) {
        return success(nextRuntime, 'Exhale complete.')
    }

    return buildOutcome(nextRuntime, {
        status: 'validating',
        liveHint: 'Keep breathing out gently.',
    })
}

function evaluateMouthSeal(step, runtime, frame) {
    const nextRuntime = { ...runtime }
    const deltaMs = Math.max(0, frame?.deltaMs ?? 0)
    const mouthDistance = frame?.mouthDistance ?? 1
    const uprightScore = frame?.uprightScore ?? 0
    const isActive =
        mouthDistance <= (step.successWindow?.maxMouthDistance ?? 0.18) &&
        uprightScore >= (step.successWindow?.minUprightScore ?? 0.8)

    markActive(nextRuntime, isActive, deltaMs)
    nextRuntime.progress = getContinuousProgress(nextRuntime, step.requiredHoldMs)

    if (!isActive) {
        const liveHint =
            mouthDistance > (step.successWindow?.maxMouthDistance ?? 0.18)
                ? 'Bring the mouthpiece closer to your lips.'
                : 'Keep the inhaler upright while sealing your lips.'
        return buildOutcome(nextRuntime, {
            status: nextRuntime.progress > 0 ? 'validating' : 'awaitingAction',
            liveHint,
        })
    }

    if (nextRuntime.accumulatedMs >= step.requiredHoldMs) {
        return success(nextRuntime, 'Mouth seal looks secure.')
    }

    return buildOutcome(nextRuntime, {
        status: 'validating',
        liveHint: 'Hold the mouth seal for a moment.',
    })
}

function evaluateInhalePress(step, runtime, frame, action) {
    const nextRuntime = {
        ...runtime,
        inhaleLeadMs: runtime.inhaleLeadMs ?? 0,
        inhaleFollowMs: runtime.inhaleFollowMs ?? 0,
        pressAcceptedAt: runtime.pressAcceptedAt ?? null,
    }

    const deltaMs = Math.max(0, frame?.deltaMs ?? 0)
    const mouthDistance = frame?.mouthDistance ?? 1
    const uprightScore = frame?.uprightScore ?? 0
    const inhaleActive = frame?.inhaleActive === true
    const aligned =
        mouthDistance <= (step.successWindow?.maxMouthDistance ?? 0.18) &&
        uprightScore >= (step.successWindow?.minUprightScore ?? 0.8)

    if (inhaleActive && aligned) {
        if (!nextRuntime.wasActive) {
            nextRuntime.attempts += 1
            nextRuntime.wasActive = true
        }
        nextRuntime.inhaleLeadMs += deltaMs
        if (nextRuntime.pressAcceptedAt != null) {
            nextRuntime.inhaleFollowMs += deltaMs
        }
        nextRuntime.lastFeedbackCode = null
    } else {
        nextRuntime.wasActive = false
        if (nextRuntime.pressAcceptedAt != null && nextRuntime.inhaleFollowMs < (step.successWindow?.inhaleFollowMs ?? 700)) {
            nextRuntime.inhaleLeadMs = 0
            nextRuntime.inhaleFollowMs = 0
            nextRuntime.pressAcceptedAt = null
            nextRuntime.progress = 0
            return emitFailure(
                step,
                nextRuntime,
                'inhale_stopped_too_soon',
                'The inhale stopped too soon after pressing the inhaler.',
                'Keep inhaling steadily after you press the inhaler.',
            )
        }
        if (!inhaleActive) {
            nextRuntime.inhaleLeadMs = 0
        }
    }

    if (action?.type === 'press-canister') {
        if (!aligned) {
            return emitFailure(
                step,
                nextRuntime,
                'press_out_of_position',
                'The inhaler was pressed before the mouth seal and upright position were ready.',
                'Seal your lips around the mouthpiece and keep the inhaler upright before pressing.',
            )
        }

        if (!inhaleActive || nextRuntime.inhaleLeadMs < (step.successWindow?.inhaleLeadMs ?? 500)) {
            return emitFailure(
                step,
                nextRuntime,
                'press_without_inhale',
                'The inhaler was pressed before a slow inhale was established.',
                'Start inhaling slowly first, then press once during the inhale.',
            )
        }

        nextRuntime.pressAcceptedAt = action.timestamp ?? Date.now()
        nextRuntime.inhaleFollowMs = 0
        nextRuntime.progress = 0.55
        return buildOutcome(nextRuntime, {
            status: 'validating',
            liveHint: 'Keep inhaling after the press.',
        })
    }

    const followTarget = step.successWindow?.inhaleFollowMs ?? 700
    if (nextRuntime.pressAcceptedAt != null) {
        nextRuntime.progress = clamp01(0.55 + (nextRuntime.inhaleFollowMs / Math.max(followTarget, CLAMP_EPSILON)) * 0.45)
        if (nextRuntime.inhaleFollowMs >= followTarget) {
            return success(nextRuntime, 'Good timing. The puff happened during a slow inhale.')
        }

        return buildOutcome(nextRuntime, {
            status: 'validating',
            liveHint: 'Keep inhaling slowly after the press.',
        })
    }

    nextRuntime.progress = clamp01(nextRuntime.inhaleLeadMs / Math.max(step.successWindow?.inhaleLeadMs ?? 500, CLAMP_EPSILON) * 0.5)
    return buildOutcome(nextRuntime, {
        status: nextRuntime.progress > 0 ? 'validating' : 'awaitingAction',
        liveHint: aligned ? 'Begin a slow inhale, then press once.' : 'Bring the inhaler to your mouth and keep it upright.',
    })
}

function evaluateHoldBreath(step, runtime, frame) {
    const nextRuntime = { ...runtime }
    const deltaMs = Math.max(0, frame?.deltaMs ?? 0)
    const holdActive = frame?.holdBreathActive === true && (frame?.stabilityScore ?? 0) >= (step.successWindow?.minStability ?? 0.8)

    markActive(nextRuntime, holdActive, deltaMs)
    nextRuntime.progress = getContinuousProgress(nextRuntime, step.requiredHoldMs)

    if (!holdActive) {
        return buildOutcome(nextRuntime, {
            status: nextRuntime.progress > 0 ? 'validating' : 'awaitingAction',
            liveHint: step.mistakeHints.primary,
        })
    }

    if (nextRuntime.accumulatedMs >= step.requiredHoldMs) {
        return success(nextRuntime, 'Breath hold complete.')
    }

    return buildOutcome(nextRuntime, {
        status: 'validating',
        liveHint: `Hold steady for ${Math.ceil((step.requiredHoldMs - nextRuntime.accumulatedMs) / 1000)} more second(s).`,
    })
}

function evaluateBranchChoice(step, runtime, frame, action) {
    if (runtime.progress >= 1) {
        const nextRuntime = { ...runtime }

        if (!action || action.type !== 'branch-choice') {
            return buildOutcome(nextRuntime, {
                status: 'branching',
                liveHint: 'Choose whether a second dose is needed.',
            })
        }

        nextRuntime.attempts += 1
        return buildOutcome(nextRuntime, {
            status: 'success',
            branchChoice: action.choice === true,
            liveHint: action.choice === true ? 'Preparing the second dose.' : 'Skipping the second dose and finishing up.',
        })
    }

    const exhaleOutcome = evaluateBreathOut(step, runtime, frame)
    if (exhaleOutcome.status === 'success') {
        const nextRuntime = {
            ...exhaleOutcome.runtime,
            progress: 1,
            accumulatedMs: step.requiredHoldMs,
        }

        if (!action || action.type !== 'branch-choice') {
            return buildOutcome(nextRuntime, {
                status: 'branching',
                liveHint: 'Choose whether a second dose is needed.',
            })
        }

        nextRuntime.attempts += 1
        return buildOutcome(nextRuntime, {
            status: 'success',
            branchChoice: action.choice === true,
            liveHint: action.choice === true ? 'Preparing the second dose.' : 'Skipping the second dose and finishing up.',
        })
    }

    if (action && action.type === 'branch-choice') {
        return emitFailure(
            step,
            { ...runtime },
            'branch_before_exhale',
            'A second-dose choice was made before the user finished breathing out.',
            'Breathe out first, then choose whether to take a second dose.',
        )
    }

    return exhaleOutcome
}

export function evaluateTrainingStep({ step, runtime, frame, action }) {
    switch (step.validatorType) {
        case 'shake':
            return evaluateShake(step, runtime, frame)
        case 'capState':
            return evaluateCapState(step, runtime, frame, action)
        case 'uprightHold':
            return evaluateUprightHold(step, runtime, frame)
        case 'headTilt':
            return evaluateHeadTilt(step, runtime, frame)
        case 'breathOut':
            return evaluateBreathOut(step, runtime, frame)
        case 'mouthSeal':
            return evaluateMouthSeal(step, runtime, frame)
        case 'inhalePress':
            return evaluateInhalePress(step, runtime, frame, action)
        case 'holdBreath':
            return evaluateHoldBreath(step, runtime, frame)
        case 'branchChoice':
            return evaluateBranchChoice(step, runtime, frame, action)
        default:
            return buildOutcome({ ...runtime }, { status: 'awaitingAction', liveHint: step.mistakeHints?.primary ?? null })
    }
}

export function buildCoachInstruction(step) {
    return {
        kind: 'instruction',
        stepId: step.id,
        prompt: step.coachPrompt,
    }
}

export function buildCoachFeedback(step, feedback) {
    return {
        kind: 'feedback',
        stepId: step.id,
        prompt: feedback?.correction ?? step.mistakeHints?.primary ?? step.coachPrompt,
        feedback,
    }
}

export function summarizeStepResult(step, runtime) {
    return {
        stepId: step.id,
        instruction: step.instruction,
        attempts: runtime.attempts,
        failures: runtime.failureCount,
        progress: runtime.progress,
    }
}
