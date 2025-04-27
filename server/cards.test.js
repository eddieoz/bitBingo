import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from './index';

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

describe('GET /api/cards', () => {
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

  beforeEach(() => {
    // Reset mocks clears state like call counts and mock implementations set in tests
    vi.resetAllMocks();
    // Cannot reset gameSessionCache as it's internal to index.js
  });

  // No afterEach needed if beforeEach handles full reset

  it('should return cards for a valid nickname (cache miss path)', async () => {
    // --- Given ---
    // Configure mock implementations for this specific test
    mockFetchTx.mockResolvedValue({ blockHash: mockBlockHash, opReturnHex: mockOpReturnHex });
    mockGetParticipants.mockResolvedValue(mockParticipants);
    mockGenerateCards.mockReturnValue(mockAllCards);

    // --- When ---
    const response = await request(app)
      .get(`/api/cards?txId=${testTxId}&nickname=${testNickname}`);

    // --- Then ---
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'success',
      cards: expectedAliceCards, // Expect only Alice's cards
      blockHash: mockBlockHash
    });
    // Verify mocks were called correctly
    expect(mockFetchTx).toHaveBeenCalledWith(testTxId);
    expect(mockGetParticipants).toHaveBeenCalledWith(mockOpReturnHex);
    expect(mockGenerateCards).toHaveBeenCalledWith(mockParticipants, mockBlockHash);
  });

  it('should return 404 if nickname is not found', async () => {
    // --- Given ---
    const nonExistentNickname = 'Charlie';
    mockFetchTx.mockResolvedValue({ blockHash: mockBlockHash, opReturnHex: mockOpReturnHex });
    mockGetParticipants.mockResolvedValue(mockParticipants); // Alice & Bob returned
    mockGenerateCards.mockReturnValue(mockAllCards); // Cards for Alice & Bob generated

    // --- When ---
    const response = await request(app)
      .get(`/api/cards?txId=${testTxId}&nickname=${nonExistentNickname}`);

    // --- Then ---
    expect(response.status).toBe(404);
    expect(response.body.error).toContain(`Nickname '${nonExistentNickname}' not found`);
    // Check mocks were still called up to the filtering stage
    expect(mockFetchTx).toHaveBeenCalledTimes(1);
    expect(mockGetParticipants).toHaveBeenCalledTimes(1);
    expect(mockGenerateCards).toHaveBeenCalledTimes(1);
  });

  it('should return 400 if txId is missing', async () => {
    const response = await request(app).get(`/api/cards?nickname=${testNickname}`);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Transaction ID (txId) is required');
  });

  it('should return 400 if nickname is missing', async () => {
    const response = await request(app).get(`/api/cards?txId=${testTxId}`);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Nickname is required');
  });

  it('should return 404 if fetchTxDataAndBlockHash throws "not found"', async () => {
    // --- Given ---
    const error = new Error('Transaction ID not found.');
    mockFetchTx.mockRejectedValue(error);

    // --- When ---
    const response = await request(app)
      .get(`/api/cards?txId=${testTxId}&nickname=${testNickname}`);

    // --- Then ---
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Transaction ID not found.');
    expect(mockGetParticipants).not.toHaveBeenCalled();
    expect(mockGenerateCards).not.toHaveBeenCalled();
  });
  
  it('should return 400 if fetchTxDataAndBlockHash throws "not confirmed"', async () => {
    // --- Given ---
    const error = new Error('Transaction is not yet confirmed in a block.');
    mockFetchTx.mockRejectedValue(error);

    // --- When ---
     const response = await request(app)
      .get(`/api/cards?txId=${testTxId}&nickname=${testNickname}`);

    // --- Then ---
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Transaction is not yet confirmed in a block.');
    expect(mockGetParticipants).not.toHaveBeenCalled();
    expect(mockGenerateCards).not.toHaveBeenCalled();
  });

  it('should return 500 if getParticipantsFromOpReturn throws error', async () => {
    // --- Given ---
    const error = new Error('Failed to retrieve participant list from IPFS.');
    mockFetchTx.mockResolvedValue({ blockHash: mockBlockHash, opReturnHex: mockOpReturnHex }); // Step 1 succeeds
    mockGetParticipants.mockRejectedValue(error); // Step 2 fails

    // --- When ---
    const response = await request(app)
      .get(`/api/cards?txId=${testTxId}&nickname=${testNickname}`);

    // --- Then ---
    expect(response.status).toBe(500);
    expect(response.body.error).toContain('Failed to retrieve or process participant list');
    expect(mockGenerateCards).not.toHaveBeenCalled();
  });

}); 