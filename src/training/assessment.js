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

/**
 * Checks if the transcript contains any of the keywords for a given step.
 */
export function matchStepSpeech(transcript, stepId) {
    if (!transcript) return false
    const keywords = STEP_SPEECH_KEYWORDS[stepId] || []
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
    
    // Simple scoring logic: 70% physical, 30% speech
    const physicalScore = (correctCount / totalSteps) * 70
    const vocalScore = (speechCount / totalSteps) * 30
    const finalScore = Math.round(physicalScore + vocalScore)

    return {
        score: finalScore,
        missedSteps: missedSteps.map(s => s.shortLabel || s.instruction),
        outOfOrderSteps: outOfOrderSteps.map(id => allVisibleSteps.find(s => s.id === id)?.shortLabel || id),
        speechMisses: checklist.filter(item => !item.speechConfirmed).map(item => allVisibleSteps.find(s => s.id === item.stepId)?.shortLabel || item.stepId),
        isPass: finalScore >= 80,
    }
}
