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
    floor:  { color1: '#9a9890', color2: '#929088', border: '#707068' },
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
  },
  classroom: {
    id:    'classroom',
    label: '🎓 CLASS',
    floor:  { color1: '#2a2010', color2: '#241c0c', border: '#554428' },
    sky:   ['#0a0e14','#101820','#182030'],
    aiContext: 'You are in the Classroom — a space for learning, teaching and experimenting. ' +
      'Anyone can be the teacher or the student depending on the topic. ' +
      'Ask questions, explain concepts clearly, run thought experiments, use analogies, draw on the board, set challenges. ' +
      'When teaching: break things down step by step, check for understanding, invite questions. ' +
      'When learning: ask good questions, push back if something is unclear, connect new ideas to what you already know. ' +
      'Use [WIDGET:title]...html...[/WIDGET] to build live experiments, simulations or demonstrations on the board. ' +
      'Use [ARTIFACT:note|title|content] to write up lesson notes, summaries or key takeaways. ' +
      'This is the room where ideas get tested, not just discussed.',
    statusLabel: 'Classroom'
  }
};


