const fs = require('fs');
const file = 'src/store/useGameStore.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'isMultiplayer: false,\n  peerId: null,\n  connection: null,',
  'isMultiplayer: false,\n  peerId: null,\n  connection: null,\n  isHost: true,\n  remotePeerId: null,'
);

fs.writeFileSync(file, content);
