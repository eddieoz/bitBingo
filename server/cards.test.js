import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import request from 'supertest';

// Define mocks for the functions we expect utils to export
const mockFetchTx = vi.fn();
const mockGetParticipants = vi.fn();
const mockGenerateCards = vi.fn();

// Mock the entire ./utils module
vi.mock('./utils', () => ({
  // Use the predefined mock functions
  fetchTxDataAndBlockHash: mockFetchTx,
  getParticipantsFromOpReturn: mockGetParticipants,
  generateAllCards: mockGenerateCards,
  // Mock other exports even if not directly used in these tests, 
  // in case the endpoint implementation uses them indirectly.
  derivePublicKey: vi.fn(() => Buffer.from('mockDerivedKey')), 
  generateBingoCard: vi.fn(() => ({ grid: {} })), // Return minimal valid structure
  hashPublicKeyToNumber: vi.fn(() => 1), // Return minimal valid number
}));

// --- Test Suite Setup ---
let app;
let server; // Variable to hold the server instance for closing
let gameStates; // Variable to hold the imported gameStates map

describe('GET /api/cards/:txid/:nickname', () => {
  const testTxId = 'tx-simple-mock-test';
  const testNickname = 'Alice';
  const mockBlockHash = 'mockBlockHashABCDEF123';
  const mockOpReturnHex = '42697442696e676f4349445f53696d706c65'; // "BitBingoCID_Simple" hex
  const mockParticipants = [
      { name: 'Alice', ticket: '1' }, 
      { name: 'Bob', ticket: '2' },
      { name: 'Alice', ticket: '3' },
  ];
  const mockAllCards = [
      { cardId: 'cardA1', lineIndex: 0, username: 'Alice', grid: {}}, 
      { cardId: 'cardB1', lineIndex: 1, username: 'Bob', grid: {}}, 
      { cardId: 'cardA2', lineIndex: 2, username: 'Alice', grid: {}}
  ];
  const expectedAliceCards = [mockAllCards[0], mockAllCards[2]]; // Filtered cards
  
  // Mock initial game state structure needed by the endpoint
  const mockGameState = {
      txid: testTxId,
      status: 'initialized', 
      blockHash: mockBlockHash,
      participants: mockParticipants,
      baseSeed: 'mockBaseSeedForCardsTest',
      cards: mockAllCards, 
      drawnNumbers: [],
      drawSequence: [], 
      nextDerivationIndex: 0, 
      gmToken: 'mock-gm-token',
      lastDrawTime: null,
      gameMode: 'fullCardOnly',
      partialWinOccurred: false,
      partialWinners: null,
      fullCardWinners: null,
      isOver: false,
      continueAfterPartialWin: false
  };

  beforeAll(async () => {
    // Use require for CJS compatibility
    const serverModule = require('./index.cjs');
    app = serverModule.app;
    gameStates = serverModule.gameStates; // Get reference to the map
    server = app.listen(0);
    console.log(`[Test Server - cards.test.js] Started on port ${server.address().port}`);
  });

  afterAll(async () => {
    // Close the server after all tests in this suite are done
    await new Promise(resolve => server.close(resolve));
    console.log(`[Test Server - cards.test.js] Closed.`);
    // Clear gameStates just in case (though Vitest isolates environments usually)
    if (gameStates) gameStates.clear();
  });

  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    // Restore mock implementations needed for most tests
    mockFetchTx.mockResolvedValue({ blockHash: mockBlockHash, opReturnHex: mockOpReturnHex });
    mockGetParticipants.mockResolvedValue(mockParticipants);
    mockGenerateCards.mockReturnValue(mockAllCards);
    // --- ADD prerequisite game state --- //
    gameStates.set(testTxId, { ...mockGameState }); // Add the mock state needed by the endpoint
  });

  // afterEach is not strictly needed if beforeEach resets mocks and state

  it('should return cards for a valid nickname', async () => {
    // --- Given --- 
    // Mocks set in beforeEach
    // Game state set in beforeEach
    expect(gameStates.has(testTxId)).toBe(true); // Verify prerequisite

    // --- When ---
    // Pass the server instance directly to supertest
    const response = await request(server) // Use server instead of app
      .get(`/api/cards/${testTxId}/${testNickname}`);

    // --- Then ---
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'success',
      cards: expectedAliceCards, // Expect only Alice's cards
      blockHash: mockBlockHash
    });
  });

  it('should return 404 if nickname is not found', async () => {
    // --- Given ---
    const nonExistentNickname = 'Charlie';
    // Game state set in beforeEach
    expect(gameStates.has(testTxId)).toBe(true);

    // --- When ---
    const response = await request(server)
      .get(`/api/cards/${testTxId}/${nonExistentNickname}`);

    // --- Then ---
    expect(response.status).toBe(404);
    expect(response.body.error).toContain(`Nickname '${nonExistentNickname}' not found`);
    // Mocks should NOT have been called because the endpoint returns early after finding the game state
    expect(mockFetchTx).not.toHaveBeenCalled(); 
    expect(mockGetParticipants).not.toHaveBeenCalled();
    expect(mockGenerateCards).not.toHaveBeenCalled();
  });

  it('should return 400 if txId is missing', async () => {
    // Note: Testing missing path parameters with supertest usually results in 404, not 400.
    // The framework handles the route matching before the handler logic.
    // We will test the handler's internal validation logic separately if needed.
    // For now, just ensure a malformed path gives 404.
    const response = await request(server).get(`/api/cards//${testNickname}`); // Malformed path
    expect(response.status).toBe(404);
  });

  it('should return 400 if nickname is missing', async () => {
    // Similar to txId, missing nickname path param leads to 404.
    const response = await request(server).get(`/api/cards/${testTxId}/`); // Malformed path
    expect(response.status).toBe(404);
  });

  it('should return 404 if game state does not exist (simulating fetch error)', async () => {
    // --- Given ---
    const nonExistentTxId = 'tx-that-does-not-exist';
    gameStates.delete(nonExistentTxId); // Ensure state is not present
    // Mocks for underlying utils are irrelevant if game state check fails first

    // --- When ---
    const response = await request(server)
      .get(`/api/cards/${nonExistentTxId}/${testNickname}`);

    // --- Then ---
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Game state not found.');
    expect(mockFetchTx).not.toHaveBeenCalled();
    expect(mockGetParticipants).not.toHaveBeenCalled();
    expect(mockGenerateCards).not.toHaveBeenCalled();
  });

}); 