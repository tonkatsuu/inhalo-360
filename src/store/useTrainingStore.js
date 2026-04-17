import { create } from 'zustand'
import {
    INITIAL_STEP_ID,
    TRAINING_STEPS,
    buildCoachFeedback,
    buildCoachInstruction,
    createStepRuntime,
    evaluateTrainingStep,
    getNextStepId,
    getStepById,
    getVisibleTrainingSteps,
    isSessionRunning,
    summarizeStepResult,
} from '../training/engine.js'

function buildCoachMessageKey(message) {
    return `${message.kind}:${message.stepId ?? 'none'}:${Date.now()}`
}

function buildMistakeId() {
    return `mistake:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`
}

function getAssessmentLiveHint(sessionPhase) {
    if (sessionPhase === 'awaitingNarration') {
        return 'Action detected. Say what you just did to unlock the next step.'
    }

    if (sessionPhase === 'feedback') {
        return 'That attempt was not accepted. Continue the assessment from the current step without prompts.'
    }

    if (sessionPhase === 'completed') {
        return 'Assessment complete. Review your results.'
    }

    return 'Perform the inhaler sequence from memory and say each action out loud as you do it.'
}

function getInteractivePhaseFromOutcome(outcomeStatus) {
    if (outcomeStatus === 'validating') return 'validating'
    if (outcomeStatus === 'branching') return 'branching'
    return 'awaitingAction'
}

function isSameXRGrabOwner(left, right) {
    if (!left || !right) return false
    return left.type === right.type && left.handedness === right.handedness
}

function getInitialState() {
    const initialStep = getStepById(INITIAL_STEP_ID)

    return {
        currentStepId: INITIAL_STEP_ID,
        completedSteps: [],
        stepResults: [],
        currentStepRuntime: createStepRuntime(initialStep),
        isCapOff: false,
        isInhalerFocused: false,
        isClipboardFocused: false,
        xrGrabOwners: {
            inhaler: null,
            clipboard: null,
        },
        hasTrainingStarted: false,
        hasReviewOpen: false,
        isTrainingComplete: false,
        sessionPhase: 'idle',
        secondDoseChoice: null,
        mistakes: [],
        pendingCoachMessage: null,
        lastDeliveredCoachKey: null,
        lastUserAction: null,
        sessionError: null,
        focusDistanceOffset: 0.5,
        stepProgress: 0,
        liveHint: initialStep?.mistakeHints?.primary ?? null,
        inputMode: 'desktop',
        startedAt: null,
        completedAt: null,
        lastInputFrame: {
            deltaMs: 0,
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
        },
        assessmentChecklist: [],
        assessmentTranscript: '',
        assessmentListening: false,
        assessmentSpeechStatus: 'idle',
        assessmentSpeechSupported: true,
        assessmentSpeechError: null,
        assessmentSpeechByStep: {},
        assessmentPendingCompletion: null,
        trainingMode: null, // 'learning' | 'assessment'
        lastStepCompletion: null,
    }
}

function createQueuedCoachMessage(message) {
    return {
        ...message,
        key: buildCoachMessageKey(message),
        createdAt: Date.now(),
    }
}

export const useTrainingStore = create((set, get) => {
    const queueCoachMessage = (message, sessionPhase = 'coaching') => {
        set({
            pendingCoachMessage: createQueuedCoachMessage(message),
            sessionPhase,
        })
    }

    const recordMistake = ({ stepId = null, code, message, correction, metrics = null }) => {
        set((state) => ({
            mistakes: [
                ...state.mistakes,
                {
                    id: buildMistakeId(),
                    stepId,
                    code,
                    message,
                    correction,
                    metrics,
                    timestamp: Date.now(),
                },
            ],
        }))
    }

    const upsertAssessmentChecklistItem = (stepId, physicalComplete, speechConfirmed) => {
        set((state) => {
            const nextItem = {
                stepId,
                physicalComplete,
                speechConfirmed,
                timestamp: Date.now(),
            }
            const existingIndex = state.assessmentChecklist.findIndex((item) => item.stepId === stepId)

            if (existingIndex < 0) {
                return {
                    assessmentChecklist: [...state.assessmentChecklist, nextItem],
                }
            }

            const nextChecklist = [...state.assessmentChecklist]
            nextChecklist[existingIndex] = {
                ...nextChecklist[existingIndex],
                ...nextItem,
            }

            return {
                assessmentChecklist: nextChecklist,
            }
        })
    }

    const moveToStep = (nextStepId, secondDoseChoice = get().secondDoseChoice) => {
        const nextStep = getStepById(nextStepId)
        if (!nextStep) {
            return
        }

        const { trainingMode } = get()
        const isAssessment = trainingMode === 'assessment'
        set({
            currentStepId: nextStepId,
            currentStepRuntime: createStepRuntime(nextStep),
            stepProgress: 0,
            liveHint: isAssessment ? getAssessmentLiveHint('awaitingAction') : nextStep.mistakeHints?.primary ?? null,
            secondDoseChoice,
            assessmentPendingCompletion: null,
            sessionPhase: isAssessment ? 'awaitingAction' : get().sessionPhase,
        })

        if (!isAssessment) {
            queueCoachMessage(buildCoachInstruction(nextStep), 'coaching')
        }
    }

    const completeTraining = () => {
        const { trainingMode } = get()
        const isAssessment = trainingMode === 'assessment'

        set({
            sessionPhase: 'completed',
            hasReviewOpen: true,
            isTrainingComplete: true,
            completedAt: Date.now(),
            isInhalerFocused: false,
            isClipboardFocused: false,
            xrGrabOwners: {
                inhaler: null,
                clipboard: null,
            },
            stepProgress: 1,
            liveHint: isAssessment 
                ? getAssessmentLiveHint('completed')
                : 'Training complete. Review the session or ask Ava a follow-up question.',
            pendingCoachMessage: isAssessment ? null : createQueuedCoachMessage({
                kind: 'completion',
                prompt:
                    'Congratulate the user for completing the inhaler session, briefly reinforce the key habits, and invite follow-up questions.',
            }),
        })
    }

    const completeCurrentStep = (branchChoice = null) => {
        const state = get()
        const step = getStepById(state.currentStepId)
        if (!step) return

        const resolvedSecondDoseChoice = step.id === 'second_dose_decision' ? branchChoice : state.secondDoseChoice
        const nextStepId = getNextStepId(step.id, resolvedSecondDoseChoice)
        const nextCompletedSteps = [...state.completedSteps, step.id]
        const nextStepResults = [
            ...state.stepResults,
            {
                ...summarizeStepResult(step, state.currentStepRuntime),
                completedAt: Date.now(),
            },
        ]

        set({
            completedSteps: nextCompletedSteps,
            stepResults: nextStepResults,
            secondDoseChoice: resolvedSecondDoseChoice,
            lastStepCompletion: {
                stepId: step.id,
                nextStepId,
                completedAt: Date.now(),
            },
        })

        if (!nextStepId) {
            completeTraining()
            return
        }

        moveToStep(nextStepId, resolvedSecondDoseChoice)
    }

    const applyOutcome = (outcome, sourceAction = null) => {
        const state = get()
        const currentStep = getStepById(state.currentStepId)
        if (!currentStep) return
        const isAssessment = state.trainingMode === 'assessment'

        const nextPatch = {
            currentStepRuntime: outcome.runtime,
            stepProgress: outcome.progress,
            liveHint: isAssessment
                ? getAssessmentLiveHint(getInteractivePhaseFromOutcome(outcome.status))
                : outcome.liveHint ?? currentStep.mistakeHints?.primary ?? null,
        }

        if (outcome.status === 'success') {
            if (isAssessment) {
                const speechConfirmed = state.assessmentSpeechByStep[currentStep.id]?.confirmed === true

                if (speechConfirmed) {
                    upsertAssessmentChecklistItem(currentStep.id, true, true)
                    set({
                        ...nextPatch,
                        sessionPhase: getInteractivePhaseFromOutcome(outcome.status),
                        assessmentPendingCompletion: null,
                    })
                    completeCurrentStep(outcome.branchChoice)
                    return
                }

                set({
                    currentStepRuntime: outcome.runtime,
                    stepProgress: 1,
                    sessionPhase: 'awaitingNarration',
                    liveHint: getAssessmentLiveHint('awaitingNarration'),
                    assessmentPendingCompletion: {
                        stepId: currentStep.id,
                        branchChoice: outcome.branchChoice,
                        completedAt: Date.now(),
                    },
                    lastUserAction: sourceAction?.type ?? state.lastUserAction,
                })
                return
            }

            set(nextPatch)
            completeCurrentStep(outcome.branchChoice)
            return
        }

        if (outcome.feedback) {
            recordMistake({
                stepId: currentStep.id,
                code: outcome.feedback.code,
                message: outcome.feedback.message,
                correction: outcome.feedback.correction,
                metrics: state.lastInputFrame,
            })
            if (isAssessment) {
                set({
                    ...nextPatch,
                    sessionPhase: 'awaitingAction',
                    liveHint: getAssessmentLiveHint('feedback'),
                    lastUserAction: sourceAction?.type ?? state.lastUserAction,
                })
            } else {
                set(nextPatch)
                queueCoachMessage(buildCoachFeedback(currentStep, outcome.feedback), 'feedback')
            }
            return
        }

        const nextSessionPhase = getInteractivePhaseFromOutcome(outcome.status)
        set({
            ...nextPatch,
            sessionPhase: nextSessionPhase,
            lastUserAction: sourceAction?.type ?? state.lastUserAction,
        })
    }

    return {
        ...getInitialState(),

        startTraining: (mode = 'learning') =>
            set((state) => ({
                ...getInitialState(),
                trainingMode: mode,
                hasTrainingStarted: true,
                sessionPhase: mode === 'assessment' ? 'awaitingAction' : 'starting',
                startedAt: Date.now(),
                focusDistanceOffset: state.focusDistanceOffset,
                liveHint: mode === 'assessment' ? getAssessmentLiveHint('awaitingAction') : getInitialState().liveHint,
            })),

        markTrainingActive: () => {
            const { sessionPhase } = get()
            if (sessionPhase !== 'starting') return

            const initialStep = getStepById(INITIAL_STEP_ID)
            set({
                sessionPhase: 'coaching',
                sessionError: null,
                currentStepId: INITIAL_STEP_ID,
                currentStepRuntime: createStepRuntime(initialStep),
                stepProgress: 0,
                liveHint: initialStep?.mistakeHints?.primary ?? null,
            })
            queueCoachMessage(buildCoachInstruction(initialStep), 'coaching')
        },

        acknowledgeCoachMessage: (messageKey) => {
            const { pendingCoachMessage, currentStepId, currentStepRuntime, sessionPhase } = get()
            if (!pendingCoachMessage || pendingCoachMessage.key !== messageKey) {
                return
            }

            const currentStep = getStepById(currentStepId)
            const nextPhase =
                sessionPhase === 'completed'
                    ? 'completed'
                    : currentStep?.validatorType === 'branchChoice' && currentStepRuntime.progress >= 1
                        ? 'branching'
                        : 'awaitingAction'

            set({
                pendingCoachMessage: null,
                lastDeliveredCoachKey: messageKey,
                sessionPhase: nextPhase,
            })
        },

        setSessionError: (message) => set({ sessionError: message }),
        clearSessionError: () => set({ sessionError: null }),
        setLastUserAction: (value) => set({ lastUserAction: value }),

        recordMistake,

        setCapOff: (value) => set({ isCapOff: value }),

        setInhalerFocused: (value) => {
            const { sessionPhase } = get()
            if (value && !isSessionRunning(sessionPhase)) return
            set({ isInhalerFocused: value })
        },

        setClipboardFocused: (value) => {
            const { sessionPhase } = get()
            if (value && !isSessionRunning(sessionPhase)) return
            set({ isClipboardFocused: value })
        },

        claimXRGrab: (objectId, owner) => {
            const { sessionPhase, xrGrabOwners } = get()

            if (!isSessionRunning(sessionPhase)) return false
            if (!owner || (owner.type !== 'controller' && owner.type !== 'hand')) return false

            const currentOwner = xrGrabOwners[objectId]
            if (isSameXRGrabOwner(currentOwner, owner)) {
                return true
            }

            const sourceBusy = Object.entries(xrGrabOwners).some(([entryObjectId, entryOwner]) => (
                entryObjectId !== objectId && isSameXRGrabOwner(entryOwner, owner)
            ))

            if (sourceBusy) {
                return false
            }

            set({
                xrGrabOwners: {
                    ...xrGrabOwners,
                    [objectId]: owner,
                },
            })

            return true
        },

        releaseXRGrab: (objectId, owner = null) => {
            const { xrGrabOwners } = get()
            const currentOwner = xrGrabOwners[objectId]

            if (!currentOwner) {
                return false
            }

            if (owner && !isSameXRGrabOwner(currentOwner, owner)) {
                return false
            }

            set({
                xrGrabOwners: {
                    ...xrGrabOwners,
                    [objectId]: null,
                },
            })

            return true
        },

        setInputMode: (mode) => set({ inputMode: mode }),

        syncTrainingInput: (frame) => {
            const state = get()
            const nextInputFrame = {
                ...state.lastInputFrame,
                ...frame,
            }

            const inputModeChanged = state.inputMode !== (nextInputFrame.inputMode ?? state.inputMode)
            const frameChanged =
                JSON.stringify(state.lastInputFrame) !== JSON.stringify(nextInputFrame)
            if (inputModeChanged || frameChanged) {
                set({
                    lastInputFrame: nextInputFrame,
                    inputMode: nextInputFrame.inputMode ?? state.inputMode,
                })
            }

            if (!isSessionRunning(state.sessionPhase)) {
                return
            }

            const currentStep = getStepById(state.currentStepId)
            if (!currentStep) {
                return
            }

            const outcome = evaluateTrainingStep({
                step: currentStep,
                runtime: state.currentStepRuntime,
                frame: nextInputFrame,
                action: null,
            })

            applyOutcome(outcome)
        },

        dispatchTrainingAction: (action) => {
            const now = Date.now()
            const normalizedAction = {
                timestamp: now,
                ...action,
            }

            const state = get()
            const currentStep = getStepById(state.currentStepId)
            const isRunning = isSessionRunning(state.sessionPhase)

            if (!isRunning || !currentStep) {
                recordMistake({
                    stepId: state.currentStepId,
                    code: 'attempt_action_before_start',
                    message: 'The inhaler training interaction was used before the guided session was ready.',
                    correction: 'Press Start Training first and wait for Ava to begin the session.',
                })
                return
            }

            if (normalizedAction.type === 'remove-cap') {
                set({ isCapOff: true, lastUserAction: normalizedAction.type })
            } else if (normalizedAction.type === 'replace-cap') {
                set({ isCapOff: false, lastUserAction: normalizedAction.type })
            } else {
                set({ lastUserAction: normalizedAction.type })
            }

            const relevantActionTypes = {
                capState: ['remove-cap', 'replace-cap'],
                inhalePress: ['press-canister'],
                branchChoice: ['branch-choice'],
            }

            const allowedActions = relevantActionTypes[currentStep.validatorType] ?? []
            if (allowedActions.length > 0 && !allowedActions.includes(normalizedAction.type)) {
                recordMistake({
                    stepId: currentStep.id,
                    code: 'wrong_action_for_step',
                    message: `The action "${normalizedAction.type}" did not match the current step "${currentStep.instruction}".`,
                    correction: currentStep.mistakeHints?.primary ?? 'Return to the current step and complete it correctly.',
                    metrics: state.lastInputFrame,
                })
                return
            }

            if (allowedActions.length === 0 && ['press-canister', 'remove-cap', 'replace-cap'].includes(normalizedAction.type)) {
                recordMistake({
                    stepId: currentStep.id,
                    code: 'premature_action',
                    message: `The action "${normalizedAction.type}" happened too early for the current step "${currentStep.instruction}".`,
                    correction: currentStep.mistakeHints?.primary ?? 'Complete the current step first.',
                    metrics: state.lastInputFrame,
                })
                return
            }

            const outcome = evaluateTrainingStep({
                step: currentStep,
                runtime: state.currentStepRuntime,
                frame: state.lastInputFrame,
                action: normalizedAction,
            })

            applyOutcome(outcome, normalizedAction)
        },

        closeReview: () => set({ hasReviewOpen: false }),

        resetTrainingSession: () =>
            set((state) => ({
                ...getInitialState(),
                focusDistanceOffset: state.focusDistanceOffset,
            })),

        finishAssessment: () => {
            const { trainingMode, sessionPhase, assessmentPendingCompletion, assessmentSpeechByStep } = get()
            if (trainingMode !== 'assessment' || sessionPhase === 'completed') return

            if (assessmentPendingCompletion?.stepId) {
                upsertAssessmentChecklistItem(
                    assessmentPendingCompletion.stepId,
                    true,
                    assessmentSpeechByStep[assessmentPendingCompletion.stepId]?.confirmed === true,
                )
            }

            completeTraining()
        },

        recordAssessmentStep: upsertAssessmentChecklistItem,

        setAssessmentTranscript: (transcript) => set({ assessmentTranscript: transcript }),
        setAssessmentListening: (value) => set({ assessmentListening: value }),
        setAssessmentSpeechStatus: (value) => set({ assessmentSpeechStatus: value }),
        setAssessmentSpeechSupported: (value) => set({ assessmentSpeechSupported: value }),
        setAssessmentSpeechError: (value) => set({ assessmentSpeechError: value }),

        markAssessmentSpeech: (stepId, transcript) => {
            const state = get()
            if (state.trainingMode !== 'assessment' || !stepId) return

            if (state.assessmentSpeechByStep[stepId]?.confirmed) {
                return
            }

            set({
                assessmentSpeechByStep: {
                    ...state.assessmentSpeechByStep,
                    [stepId]: {
                        confirmed: true,
                        transcript,
                        confirmedAt: Date.now(),
                    },
                },
            })

            if (state.assessmentPendingCompletion?.stepId === stepId && state.currentStepId === stepId) {
                upsertAssessmentChecklistItem(stepId, true, true)
                set({
                    assessmentPendingCompletion: null,
                    liveHint: getAssessmentLiveHint('awaitingAction'),
                })
                completeCurrentStep(state.assessmentPendingCompletion.branchChoice ?? null)
            }
        },

        getVisibleSteps: () => getVisibleTrainingSteps(get().secondDoseChoice),
    }
})

export { TRAINING_STEPS, getStepById, getVisibleTrainingSteps }
