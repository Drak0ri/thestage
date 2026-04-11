// js/storage.js

const STORAGE_KEY = 'thestage_v1';
const RELAY_URL = 'https://script.google.com/macros/s/AKfycbxUtte8plGg9O0pPXeedpm9oKhXBndYHOMYRBWxhbHM26ZChBcbhnzBiv7x_zJPVGRq/exec';

const Storage = {

  load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { team: [], chatHistory: {}, briefing: '', conversations: {}, stageIds: [] };
      return JSON.parse(raw);
    } catch(e) { return { team: [], chatHistory: {}, briefing: '', conversations: {}, stageIds: [] }; }
  },

  save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
  },

  async cloudSave(state) {
    this.save(state);
    try {
      await fetch(RELAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'save', state: state, pin: App.pin })
      });
    } catch(e) { console.warn('cloud save failed', e); }
  },

  async cloudLoad() {
    try {
      var resp  = await fetch(RELAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'load', pin: App.pin })
      });
      var data = await resp.json();
      if (data.ok && data.state) {
        this.save(data.state);
        return data.state;
      }
      return this.load();
    } catch(e) {
      console.warn('cloud load failed, using local', e);
      return this.load();
    }
  }
};

