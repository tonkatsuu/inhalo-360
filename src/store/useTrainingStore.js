import { create } from 'zustand'

// All training steps for metered dose inhaler usage
export const TRAINING_STEPS = [
    { id: 0, text: 'Shake the inhaler well', action: 'shake' },
    { id: 1, text: 'Remove the cap', action: 'removeCap' },
    { id: 2, text: 'Hold the inhaler upright', action: 'click' },
    { id: 3, text: 'Tilt your head back slightly', action: 'tilt' },
    { id: 4, text: 'Breathe out slowly', action: 'click' },
    { id: 5, text: 'Place mouthpiece in mouth and seal with lips', action: 'click' },
    { id: 6, text: 'Breathe in slowly and press the inhaler', action: 'click' },
    { id: 7, text: 'Hold breath for 10-20 seconds', action: 'click' },
    { id: 8, text: 'Exhale and wait before second dose if needed', action: 'click' },
    { id: 9, text: '(Optional) Shake again before second dose', action: 'click', optional: true },
    { id: 10, text: 'Replace the mouthpiece cover', action: 'replaceCap' },
]

function getInitialState() {
    return {
        currentStep: 0,
        completedSteps: [],
        isCapOff: false,
        isInhalerFocused: false,
        isClipboardFocused: false,
        isShaking: false,
        isTrainingComplete: false,
        shakeDuration: 0.5,
        shakeElapsed: 0,
        lastAdvanceTs: 0,
        shakeAmount: 0.02,
        focusDistanceOffset: 0.5,
        sessionPhase: 'idle',
        hasTrainingStarted: false,
        hasReviewOpen: false,
        mistakes: [],
        lastSpokenStepKey: null,
        lastUserAction: null,
        startedAt: null,
        completedAt: null,
        sessionError: null,
    }
}

function buildMistakeId(code, stepId) {
    return `${code}:${stepId ?? 'none'}`
}

export const useTrainingStore = create((set, get) => ({
    ...getInitialState(),

    completeTraining: () =>
        set({
            sessionPhase: 'completed',
            hasReviewOpen: true,
            isTrainingComplete: true,
            completedAt: Date.now(),
            isInhalerFocused: false,
            isClipboardFocused: false,
            isShaking: false,
            shakeElapsed: 0,
        }),

    completeStep: (stepId) => {
        const { currentStep, completedSteps, sessionPhase } = get()
        if (sessionPhase !== 'active') return
        if (stepId !== currentStep) return

        const newCompleted = [...completedSteps, stepId]
        const nextStep = currentStep + 1
        const isComplete = nextStep >= TRAINING_STEPS.length

        if (isComplete) {
            set({
                completedSteps: newCompleted,
            })
            get().completeTraining()
            return
        }

        set({
            completedSteps: newCompleted,
            currentStep: nextStep,
            isTrainingComplete: false,
        })
    },

    setCapOff: (value) => {
        const { currentStep, sessionPhase } = get()
        if (sessionPhase !== 'active') return

        set({ isCapOff: value })
        if (value && currentStep === 1) {
            get().completeStep(1)
        }
        if (!value && currentStep === 10) {
            get().completeStep(10)
        }
    },

    setInhalerFocused: (value) => {
        const { sessionPhase } = get()
        if (value && sessionPhase !== 'active') return
        set({ isInhalerFocused: value })
    },

    setClipboardFocused: (value) => {
        const { sessionPhase } = get()
        if (value && sessionPhase !== 'active') return
        set({ isClipboardFocused: value })
    },

    setIsShaking: (value) => set({ isShaking: value }),
    setShakeElapsed: (value) => set({ shakeElapsed: value }),
    setSessionError: (message) => set({ sessionError: message }),
    clearSessionError: () => set({ sessionError: null }),
    setLastUserAction: (value) => set({ lastUserAction: value }),

    recordMistake: ({ stepId = null, code, message, correction }) => {
        const { mistakes } = get()
        const id = buildMistakeId(code, stepId)
        if (mistakes.some((mistake) => mistake.id === id)) {
            return
        }

        set({
            mistakes: [
                ...mistakes,
                {
                    id,
                    stepId,
                    code,
                    message,
                    correction,
                    timestamp: Date.now(),
                },
            ],
        })
    },

    clearMistakes: () => set({ mistakes: [] }),

    completeShake: () => {
        const { currentStep, sessionPhase } = get()
        if (sessionPhase !== 'active') return

        set({ isShaking: false, shakeElapsed: 0 })
        if (currentStep === 0) {
            get().completeStep(0)
        } else if (currentStep === 9) {
            get().completeStep(9)
        }
    },

    advanceStep: () => {
        const now = performance.now()
        const { currentStep, lastAdvanceTs, sessionPhase } = get()
        if (sessionPhase !== 'active') return
        if (now - lastAdvanceTs < 150) return

        const step = TRAINING_STEPS[currentStep]
        if (step && step.action === 'click') {
            set({ lastAdvanceTs: now })
            get().completeStep(currentStep)
        }
    },

    markTrainingActive: () => {
        const { sessionPhase } = get()
        if (sessionPhase !== 'starting') return
        set({ sessionPhase: 'active', sessionError: null })
    },

    markStepNarrated: (stepKey) => set({ lastSpokenStepKey: stepKey }),

    closeReview: () => set({ hasReviewOpen: false }),

    startTraining: () =>
        set((state) => ({
            ...getInitialState(),
            sessionPhase: 'starting',
            hasTrainingStarted: true,
            startedAt: Date.now(),
            completedAt: null,
            sessionError: null,
            mistakes: [],
            lastSpokenStepKey: null,
            lastUserAction: null,
            shakeDuration: state.shakeDuration,
            shakeAmount: state.shakeAmount,
            focusDistanceOffset: state.focusDistanceOffset,
        })),

    resetShake: () => set({ isShaking: false, shakeElapsed: 0 }),

    resetTraining: () =>
        set((state) => ({
            ...getInitialState(),
            shakeDuration: state.shakeDuration,
            shakeAmount: state.shakeAmount,
            focusDistanceOffset: state.focusDistanceOffset,
        })),

    resetTrainingSession: () =>
        set((state) => ({
            ...getInitialState(),
            shakeDuration: state.shakeDuration,
            shakeAmount: state.shakeAmount,
            focusDistanceOffset: state.focusDistanceOffset,
        })),
}))
