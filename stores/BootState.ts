import { defineStore } from 'pinia'

export type BootPhase = 'init' | 'booting' | 'easter-egg' | 'menu' | 'loading-scene' | 'complete'

export const useBootStateStore = defineStore('bootState', {
  state: () => ({
    phase: 'init' as BootPhase,
    sceneReady: false,
    bootCompleted: false,
  }),
  
  actions: {
    setPhase(phase: BootPhase) {
      this.phase = phase
    },
    
    markSceneReady() {
      this.sceneReady = true
    },
    
    completeBootSequence() {
      this.bootCompleted = true
      this.phase = 'complete'
    },
    
    reset() {
      this.phase = 'init'
      this.sceneReady = false
      this.bootCompleted = false
    },
  },
})

