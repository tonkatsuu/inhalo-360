import { create } from 'zustand'

export const useTrainingStore = create((set, get) => ({
  // Procedure state
  hasShaken: false,
  isCapOff: false,
  isInhalerFocused: false,
  isClipboardFocused: false,
  isShaking: false,

  // Timers / counters
  shakeDuration: 0.5,
  shakeElapsed: 0,

  // Tuning values (mirrors Unity config)
  shakeAmount: 0.02,
  focusDistanceOffset: 0.5,

  // Actions
  setHasShaken: (value) => set({ hasShaken: value }),
  setCapOff: (value) => set({ isCapOff: value }),
  setInhalerFocused: (value) => set({ isInhalerFocused: value }),
  setClipboardFocused: (value) => set({ isClipboardFocused: value }),
  setIsShaking: (value) => set({ isShaking: value }),
  setShakeElapsed: (value) => set({ shakeElapsed: value }),
  resetShake: () => set({ isShaking: false, shakeElapsed: 0 }),
  resetTraining: () =>
    set({
      hasShaken: false,
      isCapOff: false,
      isInhalerFocused: false,
      isClipboardFocused: false,
      isShaking: false,
      shakeElapsed: 0,
    }),
}))