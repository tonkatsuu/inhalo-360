import { create } from 'zustand'

// All training steps for metered dose inhaler usage
export const TRAINING_STEPS = [
    { id: 0, text: 'Shake the inhaler well', action: 'shake' },
    { id: 1, text: 'Remove the cap', action: 'removeCap' },
    { id: 2, text: 'Hold the inhaler upright', action: 'click' },
    { id: 3, text: 'Tilt your head back slightly', action: 'click' },
    { id: 4, text: 'Breathe out slowly', action: 'click' },
    { id: 5, text: 'Place mouthpiece in mouth and seal with lips', action: 'click' },
    { id: 6, text: 'Breathe in slowly and press the inhaler', action: 'click' },
    { id: 7, text: 'Hold breath for 10-20 seconds', action: 'click' },
    { id: 8, text: 'Exhale and wait before second dose if needed', action: 'click' },
    { id: 9, text: '(Optional) Shake again before second dose', action: 'click', optional: true },
    { id: 10, text: 'Replace the mouthpiece cover', action: 'replaceCap' },
]

export const useTrainingStore = create((set, get) => ({
    // Procedure state
    currentStep: 0,
    completedSteps: [],
    isCapOff: false,
    isInhalerFocused: false,
    isClipboardFocused: false,
    isShaking: false,
    isTrainingComplete: false,

    // Timers / counters
    shakeDuration: 0.5,
    shakeElapsed: 0,
    lastAdvanceTs: 0,

    // Tuning values (mirrors Unity config)
    shakeAmount: 0.02,
    focusDistanceOffset: 0.5,

    // Actions
    completeStep: (stepId) => {
        const { currentStep, completedSteps } = get()
        if (stepId !== currentStep) return // Must complete in order

        const newCompleted = [...completedSteps, stepId]
        const nextStep = currentStep + 1
        const isComplete = nextStep >= TRAINING_STEPS.length

        set({
            completedSteps: newCompleted,
            currentStep: isComplete ? currentStep : nextStep,
            isTrainingComplete: isComplete,
        })
    },

    setCapOff: (value) => {
        const { currentStep } = get()
        set({ isCapOff: value })
        // Complete step 1 when cap is removed
        if (value && currentStep === 1) {
            get().completeStep(1)
        }
        // Complete step 10 when cap is replaced
        if (!value && currentStep === 10) {
            get().completeStep(10)
        }
    },

    setInhalerFocused: (value) => set({ isInhalerFocused: value }),
    setClipboardFocused: (value) => set({ isClipboardFocused: value }),
    setIsShaking: (value) => set({ isShaking: value }),
    setShakeElapsed: (value) => set({ shakeElapsed: value }),

    completeShake: () => {
        const { currentStep } = get()
        set({ isShaking: false, shakeElapsed: 0 })
        // Complete step 0 (initial shake) or step 9 (optional second shake)
        if (currentStep === 0) {
            get().completeStep(0)
        } else if (currentStep === 9) {
            get().completeStep(9)
        }
    },

    // Advance to next step (for click-based actions)
    advanceStep: () => {
        const now = performance.now()
        const { currentStep, lastAdvanceTs } = get()
        // Guard against duplicate click events firing in quick succession
        if (now - lastAdvanceTs < 150) return

        const step = TRAINING_STEPS[currentStep]
        if (step && step.action === 'click') {
            set({ lastAdvanceTs: now })
            get().completeStep(currentStep)
        }
    },

    resetShake: () => set({ isShaking: false, shakeElapsed: 0 }),

    resetTraining: () =>
        set({
            currentStep: 0,
            completedSteps: [],
            isCapOff: false,
            isInhalerFocused: false,
            isClipboardFocused: false,
            isShaking: false,
            isTrainingComplete: false,
            shakeElapsed: 0,
            lastAdvanceTs: 0,
        }),
}))