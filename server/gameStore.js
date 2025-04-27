// Simple in-memory store for game states, keyed by txid

export const gameStates = new Map();

// Example structure for a game state entry:
// gameStates.set(txid, {
//   baseSeed: 'block-hash-seed',
//   drawnNumbers: [12, 45, 3], // List of numbers drawn so far
//   drawIndex: 3, // Current draw index (starts at 0, increments before each draw)
//   gameMasterId: 'user-id-who-started', // Optional: To verify GM requests
// }); 