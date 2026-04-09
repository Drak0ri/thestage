// js/storage.js — localStorage persistence

const STORAGE_KEY = 'thestage_v1';

const Storage = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { team: [], chatHistory: {} };
      return JSON.parse(raw);
    } catch (e) {
      console.warn('TheStage: failed to load state', e);
      return { team: [], chatHistory: {} };
    }
  },

  save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('TheStage: failed to save state', e);
    }
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  }
};
