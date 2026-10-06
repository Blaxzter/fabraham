import { defineStore } from 'pinia'

export type BootPhase = 'init' | 'booting' | 'easter-egg' | 'menu' | 'loading-scene' | 'complete'

export const useBootStateStore = defineStore('bootState', {
  state: () => ({
    phase: 'init' as BootPhase,
    /** The head model is downloaded and parsed. */
    modelReady: false,
    /**
     * The scene has drawn and its shaders are compiled (SceneWarmup), so the
     * boot can hand over to it without the first seconds of it stuttering.
     * Later than `modelReady` by however long this machine takes to get there.
     */
    sceneReady: false,
    bootCompleted: false,
    /**
     * The head model coming down the wire, 0..1. The boot's memory test counts
     * against this rather than a timer, so the one number on that screen is
     * true. Written by Scene3D through `downloadWithProgress`.
     */
    loadProgress: 0,
  }),

  actions: {
    setPhase(phase: BootPhase) {
      this.phase = phase
    },

    // Monotonic: a progress bar that goes backwards reads as a bug.
    setLoadProgress(fraction: number) {
      const next = Math.min(1, Math.max(0, fraction))
      if (next > this.loadProgress) this.loadProgress = next
    },

    markModelReady() {
      this.loadProgress = 1
      this.modelReady = true
    },

    markSceneReady() {
      this.markModelReady()
      this.sceneReady = true
    },

    completeBootSequence() {
      this.bootCompleted = true
      this.phase = 'complete'
    },

    reset() {
      this.phase = 'init'
      this.modelReady = false
      this.sceneReady = false
      this.bootCompleted = false
      this.loadProgress = 0
    },
  },
})
