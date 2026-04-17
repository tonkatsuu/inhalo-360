/**
 * Keywords for each training step to verify vocal narration in Assessment mode.
 */
export const STEP_SPEECH_KEYWORDS = {
    shake_initial: ['shake', 'shaking', 'mix', 'mixing', 'agitate'],
    remove_cap: ['remove', 'take off', 'cap', 'cover', 'mouthpiece'],
    hold_upright: ['upright', 'steady', 'vertical', 'straight'],
    tilt_head: ['tilt', 'head', 'back', 'chin up'],
    breathe_out: ['breathe out', 'exhale', 'empty', 'lungs'],
    mouth_seal: ['mouth', 'seal', 'lips', 'around', 'in'],
    inhale_press: ['inhale', 'breathe in', 'press', 'puff', 'squeeze', 'button', 'canister'],
    hold_breath: ['hold', 'counting', 'one', 'two', 'three', 'breath'],
    second_dose_decision: ['second', 'dose', 'again', 'repeat', 'another', 'yes', 'no', 'need'],
    second_dose_shake: ['shake', 'shaking', 'mix', 'again'],
    second_dose_breathe_out: ['breathe out', 'exhale', 'again'],
    second_dose_mouth_seal: ['mouth', 'seal', 'lips', 'again'],
    second_dose_inhale_press: ['inhale', 'press', 'again', 'puff'],
    second_dose_hold_breath: ['hold', 'again'],
    replace_cap: ['replace', 'put back', 'cap', 'cover', 'finish', 'done'],
}

export function getStepSpeechKeywords(stepId) {
    return STEP_SPEECH_KEYWORDS[stepId] ?? []
}

/**
 * Checks if the transcript contains any of the keywords for a given step.
 */
export function matchStepSpeech(transcript, stepId) {
    if (!transcript) return false
    const keywords = getStepSpeechKeywords(stepId)
    return keywords.some((keyword) => transcript.toLowerCase().includes(keyword))
}

/**
 * Builds assessment results based on the recorded checklist.
 */
export function buildAssessmentResults(checklist, allVisibleSteps) {
    const completedStepIds = checklist.map((item) => item.stepId)
    const missedSteps = allVisibleSteps.filter((step) => !completedStepIds.includes(step.id))
    
    // Check for out-of-order steps
    const outOfOrderSteps = []
    let lastIndex = -1
    checklist.forEach((item) => {
        const currentIndex = allVisibleSteps.findIndex((s) => s.id === item.stepId)
        if (currentIndex === -1) return
        if (currentIndex < lastIndex) {
            outOfOrderSteps.push(item.stepId)
        }
        lastIndex = currentIndex
    })

    const totalSteps = allVisibleSteps.length
    const correctCount = checklist.filter(item => item.physicalComplete && !outOfOrderSteps.includes(item.stepId)).length
    const speechCount = checklist.filter(item => item.speechConfirmed).length
    const completedLabels = checklist
        .map((item) => allVisibleSteps.find((step) => step.id === item.stepId)?.shortLabel || item.stepId)
    
    // Simple scoring logic: 70% physical, 30% speech
    const physicalScore = totalSteps > 0 ? (correctCount / totalSteps) * 70 : 0
    const vocalScore = totalSteps > 0 ? (speechCount / totalSteps) * 30 : 0
    const finalScore = Math.round(physicalScore + vocalScore)
    const completedInSequence = checklist.length > 0 && outOfOrderSteps.length === 0
    const stepBreakdown = allVisibleSteps.map((step) => {
        const checklistItem = checklist.find((item) => item.stepId === step.id)

        if (!checklistItem) {
            return {
                stepId: step.id,
                label: step.shortLabel || step.instruction,
                status: 'missed',
            }
        }

        if (!checklistItem.speechConfirmed) {
            return {
                stepId: step.id,
                label: step.shortLabel || step.instruction,
                status: 'completed_without_narration',
            }
        }

        if (outOfOrderSteps.includes(step.id)) {
            return {
                stepId: step.id,
                label: step.shortLabel || step.instruction,
                status: 'out_of_order',
            }
        }

        return {
            stepId: step.id,
            label: step.shortLabel || step.instruction,
            status: 'completed_in_sequence',
        }
    })

    return {
        score: finalScore,
        totalSteps,
        completedCount: checklist.length,
        completedLabels,
        completedInSequence,
        missedSteps: missedSteps.map(s => s.shortLabel || s.instruction),
        outOfOrderSteps: outOfOrderSteps.map(id => allVisibleSteps.find(s => s.id === id)?.shortLabel || id),
        speechMisses: checklist.filter(item => !item.speechConfirmed).map(item => allVisibleSteps.find(s => s.id === item.stepId)?.shortLabel || item.stepId),
        isPass: finalScore >= 80,
        stepBreakdown,
    }
}
