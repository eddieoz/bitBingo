const request = require('supertest');
const axios = require('axios');
const app = require('./index'); // Assuming your Express app is exported from index.js
const crypto = require('crypto');
// Remove explicit vitest imports as globals are now enabled
// const { vi, describe, test, expect, beforeEach } = require('vitest'); 

// Mock axios with explicit factory, targeting both default and named exports
vi.mock('axios', () => {
  const mockGet = vi.fn();
  const mockPost = vi.fn();
  // Add mocks for other methods if needed
  return {
    default: {
      get: mockGet,
      post: mockPost,
      // Add other methods used via axios.default.method
    },
    get: mockGet, // Ensure named export is the same mock function
    post: mockPost
  };
});

// Mock helper functions (implementation TBD) using Vitest global `vi`
const mockDerivePublicKey = vi.fn((seedHash, index) => Buffer.from(`pubKey-for-${index}`));
const mockGenerateBingoCard = vi.fn(publicKey => ({
  cardId: `card-${publicKey.toString()}`,
  grid: [[], [], [], [], []] // Placeholder structure
}));

// Temporarily assign mocks to global scope IF NEEDED by the tested module.
// Ideally, the module should import these helpers, allowing proper mocking.
// If index.js doesn't import them, these globals might still be necessary for now.
global.derivePublicKey = mockDerivePublicKey;
global.generateBingoCard = mockGenerateBingoCard;

describe('POST /api/cards', () => {
  const mockTxId = 'tx123abc';
  const mockNickname = 'Alice';
  const mockHexCID = '4a4a4a4a4a4a4a4a'; // Example hex CID
  const mockStandardCID = Buffer.from(mockHexCID, 'hex').toString(); // Simple conversion example
  const mockBlockHeight = 800000;
  const mockPrevBlockHeight = mockBlockHeight - 1;
  const mockPrevBlockHash = 'prevBlockHash789xyz';
  const mockIpfsGatewayBase = process.env.PINATA_PUBLIC_GATEWAY_BASE || 'https://ipfs.io/ipfs';
  const mockIpfsUrl = `${mockIpfsGatewayBase}/${mockStandardCID}`;
  const mockCsvContent = `Game Title\nname,other_col\nAlice,data1\nBob,data2\nCharlie,data3\nAlice,data4`; // Alice on lines 2 and 5 (1-based data lines)

  beforeEach(() => {
    vi.clearAllMocks(); 
  });

  test('(Happy Path) should generate cards for a valid nickname and confirmed txId', async () => {
    // --- GIVEN ---
    // Now use the mocked axios.get directly
    // Mock BlockCypher TX response
    axios.get.mockResolvedValueOnce({
      data: {
        hash: mockTxId,
        block_height: mockBlockHeight,
        confirmed: new Date().toISOString(),
        outputs: [
          { script_type: 'pubkeyhash', addresses: ['addr1'], value: 10000 },
          { script_type: 'null-data', data_hex: mockHexCID, value: 0 }
        ]
      }
    });

    // Mock BlockCypher Previous Block response
    axios.get.mockResolvedValueOnce({
      data: {
        hash: mockPrevBlockHash,
        height: mockPrevBlockHeight
      }
    });

    // Mock IPFS Gateway CSV response
    axios.get.mockResolvedValueOnce({
      data: mockCsvContent
    });

    // --- WHEN ---
    const response = await request(app)
      .post('/api/cards')
      .send({ nickname: mockNickname, transactionId: mockTxId });

    // --- THEN ---
    // Check axios calls directly
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining(`/txs/${mockTxId}`));
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining(`/blocks/${mockPrevBlockHeight}`));
    expect(axios.get).toHaveBeenCalledWith(mockIpfsUrl);
    
    // Check derivePublicKey calls (1-based index for lines 2 and 5 -> paths m/.../2 and m/.../5)
    expect(mockDerivePublicKey).toHaveBeenCalledTimes(2);
    expect(mockDerivePublicKey).toHaveBeenCalledWith(mockPrevBlockHash, 2);
    expect(mockDerivePublicKey).toHaveBeenCalledWith(mockPrevBlockHash, 5);

    // Check generateBingoCard calls
    expect(mockGenerateBingoCard).toHaveBeenCalledTimes(2);
    expect(mockGenerateBingoCard).toHaveBeenCalledWith(Buffer.from('pubKey-for-2'));
    expect(mockGenerateBingoCard).toHaveBeenCalledWith(Buffer.from('pubKey-for-5'));

    // Check response
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('status', 'success');
    expect(response.body).toHaveProperty('cards');
    expect(Array.isArray(response.body.cards)).toBe(true);
    expect(response.body.cards).toHaveLength(2);
    // Check card structure (adjust based on actual implementation)
    expect(response.body.cards[0]).toEqual(expect.objectContaining({ 
        cardId: expect.any(String), 
        lineIndex: 2, 
        grid: expect.any(Array) 
    }));
     expect(response.body.cards[1]).toEqual(expect.objectContaining({ 
        cardId: expect.any(String), 
        lineIndex: 5, 
        grid: expect.any(Array) 
    }));

  });

  // (Red) TODO: Add tests for Scenario 2 (Nickname Not Found)
  // (Red) TODO: Add tests for Scenario 3 (Invalid TXID)
  // (Red) TODO: Add tests for Scenario 4 (Unconfirmed TX)
  // (Red) TODO: Add tests for Scenario 5 (Missing OP_RETURN)
  // (Red) TODO: Add test for error fetching previous block
  // (Red) TODO: Add test for error fetching IPFS file
  // (Red) TODO: Add test for CSV parsing error

}); 