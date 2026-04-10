// js/rooms.js — room definitions

const ROOMS = {
  stage: {
    id:    'stage',
    label: '🎭 STAGE',
    floor:  { color1: '#1e1c3a', color2: '#1a1838', border: '#4444aa' },
    sky:   ['#050410','#0a0920','#1a1840'],
    aiContext: 'You are in The Stage — a neutral open space. Be yourself, relaxed and conversational.',
    statusLabel: 'The Stage'
  },
  boardroom: {
    id:    'boardroom',
    label: '🏛 BOARDROOM',
    floor:  { color1: '#2a2a2e', color2: '#242428', border: '#555560' },
    sky:   ['#0a0806','#1a1008','#2a1e10'],
    aiContext: 'You are in the Boardroom. Be professional, focused and concise. Speak as if in a formal meeting — structured, direct, no fluff. Reference agendas, decisions, action points where relevant.',
    statusLabel: 'Boardroom'
  },
  playground: {
    id:    'playground',
    label: '🎨 PLAYGROUND',
    floor:  { color1: '#0a2a0a', color2: '#081e08', border: '#44aa44' },
    sky:   ['#050a10','#0a1520','#102030'],
    aiContext: 'You are in the Playground — a creative free space. Be loose, playful, imaginative and enthusiastic. Riff on ideas, make unexpected connections, be encouraging and a little chaotic. Creativity over correctness.',
    statusLabel: 'Playground'
  }
};
