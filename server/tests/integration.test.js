import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import axios from 'axios';
import fs from 'fs'; // Original fs for spyOn
import fsPromises from 'fs/promises';
import crypto from 'crypto';
import path from 'path'; // Import path

// Mock external dependencies
vi.mock('axios');
vi.mock('fs/promises');
vi.mock('crypto');
// vi.mock('path'); // Keep basic mock for path if needed - Let's remove the global path mock for now

// --- Utils Mock MUST come BEFORE server import ---
const mockFetchTxDataAndBlockHash = vi.fn();
const mockGetParticipantsFromOpReturn = vi.fn();
const mockGenerateAllCards = vi.fn();

vi.mock('../utils', () => ({
    fetchTxDataAndBlockHash: mockFetchTxDataAndBlockHash,
    getParticipantsFromOpReturn: mockGetParticipantsFromOpReturn,
    generateAllCards: mockGenerateAllCards,
    // Add other utils if they might be called indirectly and need mocking
}));
// --- End Utils Mock ---

// Import Server Module AFTER mocks
import { app, gameStates, uploadDir } from '../index';

let server;
// --- Removed handler mocking variables and helper ---
// let originalCheckTransactionHandler = null;
// function findRouteLayer(...) { ... }

describe('API Endpoints Integration Tests', () => {

    beforeAll(async () => {
        server = app.listen(0);
        console.log(`[Test Server - integration.test.js] Started on port ${server.address().port}`);
        // --- Removed handler finding logic ---
    });

    afterAll(async () => {
        // --- Removed handler restoration logic ---
        await new Promise(resolve => server.close(resolve));
        console.log(`[Test Server - integration.test.js] Closed.`);
    });

    beforeEach(() => {
        vi.clearAllMocks(); // Clears external mocks

        // Reset internal utils mocks
        mockFetchTxDataAndBlockHash.mockReset();
        mockGetParticipantsFromOpReturn.mockReset();
        mockGenerateAllCards.mockReset();

        // Reset external mocks as needed (e.g., path)
        // vi.mocked(path.basename).mockClear(); // No longer mocking path globally
        // vi.mocked(path.join).mockClear();

        // Clear gameStates
        gameStates.clear();
        
        // --- Removed handler restoration logic ---
    });

    afterEach(() => {
        // Restore spies used within tests
        vi.restoreAllMocks(); // Use restoreAllMocks to catch spies too
         // --- Removed handler restoration logic ---
    });

    describe('POST /api/check-transaction', () => {
        it('should successfully initialize a new game', async () => {
            const mockTxId = 'valid-txid-simple';
            const mockInputFilename = 'participants-simple.csv';
            const mockBlockHash = 'mock-block-hash-simple';
            const mockOpReturnHex = 'mock-op-return-hex-simple';
            const mockParticipants = [{ name: 'Alice' }, { name: 'Bob' }];
            const mockCards = [ { cardId: 'c1'}, { cardId: 'c2'} ]; // Simplified mock cards
            const expectedGmToken = Buffer.from('test-gm-token-buffer').toString('hex');
            const mockGameMode = 'fullCardOnly';

            // --- Setup Mocks ---
            const expectedCheckPath = path.join(uploadDir, mockInputFilename);
            const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
            // Don't mock path.basename or path.join globally if not strictly necessary
            // vi.mocked(path.basename).mockReturnValue(mockInputFilename);
            // vi.mocked(path.join).mockReturnValue(expectedCheckPath); 
            fsPromises.unlink.mockResolvedValue(undefined); // Mock unlink success
            crypto.randomBytes.mockReturnValue(Buffer.from('test-gm-token-buffer'));

            // Configure utils mocks for success
            mockFetchTxDataAndBlockHash.mockResolvedValue({ blockHash: mockBlockHash, opReturnHex: mockOpReturnHex });
            mockGetParticipantsFromOpReturn.mockResolvedValue(mockParticipants);
            mockGenerateAllCards.mockReturnValue(mockCards);
            // --- End Mock Setup ---

            // --- Explicitly reconfigure mocks just before request (belt-and-suspenders) ---
            mockFetchTxDataAndBlockHash.mockResolvedValue({ blockHash: mockBlockHash, opReturnHex: mockOpReturnHex });
            mockGetParticipantsFromOpReturn.mockResolvedValue(mockParticipants);
            mockGenerateAllCards.mockReturnValue(mockCards);
            // --- End Reconfiguration ---

            // --- Removed Handler Replacement --- 

            const response = await request(server)
                .post('/api/check-transaction')
                .send({ txid: mockTxId, participantFilename: mockInputFilename, gameMode: mockGameMode });

            // --- Assertions ---
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                message: 'Transaction confirmed and game state initialized.',
                txid: mockTxId,
                blockHash: mockBlockHash,
                participantCount: mockParticipants.length,
                gmToken: expectedGmToken
            });

            // Assert mocks were called
            expect(existsSyncSpy).toHaveBeenCalledWith(expectedCheckPath);
            expect(mockFetchTxDataAndBlockHash).toHaveBeenCalledWith(mockTxId);
            expect(mockGetParticipantsFromOpReturn).toHaveBeenCalledWith(mockOpReturnHex);
            expect(mockGenerateAllCards).toHaveBeenCalledWith(mockParticipants, mockBlockHash);
            expect(fsPromises.unlink).toHaveBeenCalledWith(expectedCheckPath);
            expect(crypto.randomBytes).toHaveBeenCalledWith(16);

            // Assert game state
            expect(gameStates.has(mockTxId)).toBe(true);
            const createdState = gameStates.get(mockTxId);
            expect(createdState).toEqual(expect.objectContaining({
                txid: mockTxId,
                status: 'initialized',
                blockHash: mockBlockHash,
                participants: mockParticipants,
                baseSeed: mockBlockHash,
                cards: mockCards,
                drawnNumbers: [],
                nextDerivationIndex: 0,
                gmToken: expectedGmToken,
                gameMode: mockGameMode,
                isOver: false
            }));
        });

        it('should return 404 if participant file does not exist', async () => {
            const mockTxId = 'valid-txid-file-not-found';
            const mockInputFilename = 'nonexistent.csv';
            const mockGameMode = 'partialAndFull';
            const expectedCheckPath = path.join(uploadDir, mockInputFilename);

            // --- Setup Mocks ---
            const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);
            // REMOVED path mocks for this test to simplify
            // vi.mocked(path.basename).mockReturnValue(mockInputFilename);
            // vi.mocked(path.join).mockReturnValue(expectedCheckPath);
            // Ensure other mocks are not called
            // --- End Mock Setup ---

            // --- Removed Handler Replacement --- 

            const response = await request(server)
                .post('/api/check-transaction')
                .send({ txid: mockTxId, participantFilename: mockInputFilename, gameMode: mockGameMode });

            // --- Assertions ---
            expect(response.status).toBe(404);
            expect(response.body.message).toBe('Participant file not found.');
            
            // Assert only relevant mocks were called
            expect(existsSyncSpy).toHaveBeenCalledWith(expectedCheckPath); // Assert with path calculated using real path.join
            // expect(path.join).toHaveBeenCalledWith(uploadDir, mockInputFilename); // Cannot assert call count on real path.join
            expect(mockFetchTxDataAndBlockHash).not.toHaveBeenCalled();
            expect(mockGetParticipantsFromOpReturn).not.toHaveBeenCalled();
            expect(mockGenerateAllCards).not.toHaveBeenCalled();
            expect(fsPromises.unlink).not.toHaveBeenCalled();
            expect(gameStates.has(mockTxId)).toBe(false);
        });

        // TODO: Add tests for other conditions (Game Exists, Missing Input, TX Error, etc.)
    });
}); 