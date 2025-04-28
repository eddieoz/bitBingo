import { describe, it, expect } from 'vitest';
import { derivePublicKey } from '../utils'; // Adjust path as necessary
import { generateBingoCard } from '../utils'; // Import the function to test
import { hashPublicKeyToNumber } from '../utils'; // Import the function to test
import { generateAllCards } from '../utils'; // Import the function to test
import { calculateMaxMarkedInLine } from '../utils'; // Import the function to test
import { checkLineWin, checkFullCardWin } from '../utils'; // Import the win condition functions

describe('derivePublicKey', () => {
  it('should return the correct public key for a given seed hash and index', () => {
    // Given: Valid seed hash and index from start-story.mdc
    const seedHash = '000000000000000000006f9367863b3fa7ecbc605c8215ef9e92386cbec8255f';
    const index = 0; // Path m/44'/0'/0'/0/0
    const expectedPublicKeyHex = '0221f19d6298f375ef4b2f829fbe479567d2a186aabef4f7790d7a73d32ff68145';

    // When: derivePublicKey is called
    const derivedKeyBuffer = derivePublicKey(seedHash, index);

    // Then: The returned public key buffer should match the expected hex value
    expect(derivedKeyBuffer).toBeInstanceOf(Buffer);
    expect(derivedKeyBuffer.toString('hex')).toBe(expectedPublicKeyHex);
  });

  // Input Validation Tests (TDD)
  it('should throw an error for invalid seedHash input', () => {
    // Given: Invalid seedHashes
    const invalidSeeds = [
      null,
      undefined,
      '',
      'not a hex string',
      12345, // Not a string
    ];
    const validIndex = 0;

    // When/Then: Calling with invalid seedHash throws an error
    invalidSeeds.forEach(seed => {
      expect(() => derivePublicKey(seed, validIndex)).toThrow(/Invalid seedHash/i);
    });
  });

  it('should throw an error for invalid index input', () => {
    // Given: Invalid indices
    const invalidIndices = [
      null,
      undefined,
      -1,
      'not a number',
      1.5, // Not an integer (though the path might allow it, our constraint is integer)
    ];
    const validSeed = '000000000000000000006f9367863b3fa7ecbc605c8215ef9e92386cbec8255f';

    // When/Then: Calling with invalid index throws an error
    invalidIndices.forEach(index => {
      // Check for specific error messages if the implementation provides them
      expect(() => derivePublicKey(validSeed, index)).toThrow(/Invalid index/i);
    });

    // Specifically test for non-number type if not covered by the above message
    expect(() => derivePublicKey(validSeed, 'abc')).toThrow(/Invalid index/i);

    // Test for floating point number explicitly if needed based on implementation detail
    expect(() => derivePublicKey(validSeed, 1.5)).toThrow(/Invalid index/i);
  });
});

describe('generateBingoCard', () => {
  // Helper to get a valid public key for testing
  const getTestPublicKey = () => {
    const seedHash = '000000000000000000006f9367863b3fa7ecbc605c8215ef9e92386cbec8255f';
    const index = 1; // Use a different index for variety
    return derivePublicKey(seedHash, index);
  };

  it('should return a valid card structure', () => { // Renamed from (TDD: Red)
    // Given: A valid public key buffer
    const publicKey = getTestPublicKey();
    console.log(`[Test] Using publicKey for card gen: ${publicKey.toString('hex')}`);

    // When: generateBingoCard is called
    const card = generateBingoCard(publicKey);

    // Then: The returned object should have the correct structure
    expect(card).toBeDefined();
    expect(card).toHaveProperty('cardId');
    expect(typeof card.cardId).toBe('string');
    expect(card).toHaveProperty('grid');
    expect(typeof card.grid).toBe('object');

    // Check grid structure (columns B, I, N, G, O)
    const columns = ['B', 'I', 'N', 'G', 'O'];
    expect(Object.keys(card.grid)).toEqual(columns);

    // Check each column has 5 entries
    columns.forEach(col => {
      expect(card.grid[col]).toBeInstanceOf(Array);
      expect(card.grid[col]).toHaveLength(5);
    });

    // Check the free space (N column, 3rd element, index 2)
    expect(card.grid.N[2]).toBeNull();

    // Check that other N spaces are numbers
    expect(typeof card.grid.N[0]).toBe('number');
    expect(typeof card.grid.N[1]).toBe('number');
    expect(typeof card.grid.N[3]).toBe('number');
    expect(typeof card.grid.N[4]).toBe('number');

    // Check other columns contain only numbers
    ['B', 'I', 'G', 'O'].forEach(col => {
      card.grid[col].forEach(num => {
        expect(typeof num).toBe('number');
      });
    });
  });

  it('should generate unique numbers within the correct range for each column', () => { // Renamed from (TDD: Red)
    // Given: A valid public key buffer
    const publicKey = getTestPublicKey();

    // When: generateBingoCard is called
    const card = generateBingoCard(publicKey);
    const grid = card.grid;

    // Then: Check ranges and uniqueness
    const ranges = {
      B: { min: 1, max: 15 },
      I: { min: 16, max: 30 },
      N: { min: 31, max: 45 },
      G: { min: 46, max: 60 },
      O: { min: 61, max: 75 },
    };

    Object.entries(ranges).forEach(([col, range]) => {
      const columnNumbers = grid[col].filter(num => num !== null); // Exclude free space for checks
      const uniqueNumbers = new Set(columnNumbers);

      // Check uniqueness within the column (excluding the null)
      expect(uniqueNumbers.size).toBe(columnNumbers.length);

      // Check if all numbers are within the expected range for the column
      columnNumbers.forEach(num => {
        expect(num).toBeGreaterThanOrEqual(range.min);
        expect(num).toBeLessThanOrEqual(range.max);
      });
    });
  });

  it('should be deterministic (same input yields same output)', () => {
    // Given: The same public key buffer
    const publicKey = getTestPublicKey();

    // When: generateBingoCard is called multiple times with the same key
    const card1 = generateBingoCard(publicKey);
    const card2 = generateBingoCard(publicKey);

    // Then: The generated grids and cardIds should be identical
    expect(card1.grid).toEqual(card2.grid);
    expect(card1.cardId).toEqual(card2.cardId);
  });

  it('should produce different cards for different inputs', () => {
    // Given: Two different public key buffers
    const publicKey1 = getTestPublicKey(); // Uses index 1
    const publicKey2 = derivePublicKey('000000000000000000006f9367863b3fa7ecbc605c8215ef9e92386cbec8255f', 2); // Index 2

    // When: generateBingoCard is called with different keys
    const card1 = generateBingoCard(publicKey1);
    const card2 = generateBingoCard(publicKey2);

    // Then: The generated grids and cardIds should be different
    expect(publicKey1.toString('hex')).not.toEqual(publicKey2.toString('hex')); // Sanity check keys are different
    expect(card1.grid).not.toEqual(card2.grid);
    expect(card1.cardId).not.toEqual(card2.cardId);
  });

  it('should throw an error for invalid publicKey input', () => {
    // Given: Invalid public keys
    const invalidKeys = [
      null,
      undefined,
      Buffer.from(''), // Empty buffer
      'not a buffer',
      {}, // Not a buffer
    ];

    // When/Then: Calling with invalid key throws an error
    invalidKeys.forEach(key => {
      expect(() => generateBingoCard(key)).toThrow(/Invalid publicKey/i);
    });
  });
});

describe('hashPublicKeyToNumber', () => {
  // Use the same helper
  const getTestPublicKey = () => {
    const seedHash = '000000000000000000006f9367863b3fa7ecbc605c8215ef9e92386cbec8255f';
    const index = 3; // Yet another index
    return derivePublicKey(seedHash, index);
  };

  it('should return a number between 1 and 75 (inclusive)', () => { // Renamed from (TDD: Red)
    // Given: A valid public key buffer
    const publicKey = getTestPublicKey();
    console.log(`[Test] Using publicKey for number gen: ${publicKey.toString('hex')}`);

    // When: hashPublicKeyToNumber is called
    const number = hashPublicKeyToNumber(publicKey);

    // Then: The number should be within the valid Bingo range
    expect(typeof number).toBe('number');
    expect(number).toBeGreaterThanOrEqual(1);
    expect(number).toBeLessThanOrEqual(75);
  });

  it('should be deterministic (same input yields same output)', () => {
    // Given: The same public key buffer
    const publicKey = getTestPublicKey();

    // When: hashPublicKeyToNumber is called multiple times with the same key
    const number1 = hashPublicKeyToNumber(publicKey);
    const number2 = hashPublicKeyToNumber(publicKey);

    // Then: The generated numbers should be identical
    expect(number1).toBe(number2);
  });

  it('should throw an error for invalid publicKey input', () => {
    // Given: Invalid public keys (reusing from generateBingoCard tests)
    const invalidKeys = [
      null,
      undefined,
      Buffer.from(''), // Empty buffer
      'not a buffer',
      {}, // Not a buffer
      Buffer.alloc(3), // Buffer too short (needs 4 bytes)
    ];

    // When/Then: Calling with invalid key throws an error
    invalidKeys.forEach(key => {
      if (Buffer.isBuffer(key) && key.length < 4 && key.length > 0) {
        // Specific error for short buffers
        expect(() => hashPublicKeyToNumber(key)).toThrow(/Public key buffer is too short/i);
      } else {
        // General error for other invalid types
        expect(() => hashPublicKeyToNumber(key)).toThrow(/Invalid publicKey/i);
      }
    });
  });
});

describe('generateAllCards', () => {
  const blockHash = '000000000000000000006f9367863b3fa7ecbc605c8215ef9e92386cbec8255f';
  // Sample participant list (mimicking structure from CSV parsing)
  const participants = [
    { name: 'Alice', someOtherData: 'abc' }, // Simulate potential extra CSV columns
    { name: 'Bob', someOtherData: 'def' },
    { name: 'Charlie', someOtherData: 'ghi' },
  ];

  it('should return an array of card objects matching the participant list structure', () => { // Renamed from (TDD: Red)
    // Given: Participants and block hash
    // When: generateAllCards is called
    const allCards = generateAllCards(participants, blockHash);

    // Then: Check array length and structure of each element
    expect(allCards).toBeInstanceOf(Array);
    expect(allCards).toHaveLength(participants.length);

    allCards.forEach((card, index) => {
      expect(card).toBeDefined();
      expect(card).toHaveProperty('cardId');
      expect(typeof card.cardId).toBe('string');
      expect(card).toHaveProperty('grid');
      expect(typeof card.grid).toBe('object'); // Deeper grid checks done in generateBingoCard tests
      expect(card).toHaveProperty('username');
      expect(card.username).toBe(participants[index].name);
      expect(card).toHaveProperty('lineIndex');
      expect(card.lineIndex).toBe(index); // Expect 0-based index
    });
  });

  it('should throw an error if participants or blockHash are missing/invalid', () => {
    // Given: Invalid inputs
    const validParticipants = [{ name: 'Test' }];
    const validBlockHash = '000000000000000000006f9367863b3fa7ecbc605c8215ef9e92386cbec8255f';

    // When/Then: Expect errors for missing or null inputs
    expect(() => generateAllCards(null, validBlockHash)).toThrow(/Missing participants or blockHash/i);
    expect(() => generateAllCards(undefined, validBlockHash)).toThrow(/Missing participants or blockHash/i);
    expect(() => generateAllCards([], validBlockHash)).not.toThrow(); // Empty array is valid, returns empty array
    expect(() => generateAllCards(validParticipants, null)).toThrow(/Missing participants or blockHash/i);
    expect(() => generateAllCards(validParticipants, undefined)).toThrow(/Missing participants or blockHash/i);
    expect(() => generateAllCards(validParticipants, '')).toThrow(/Missing participants or blockHash/i);
  });
});

describe('calculateMaxMarkedInLine', () => {
  // Sample grid for testing (structure matches generateBingoCard output)
  const sampleGrid = {
    B: [1, 5, 10, 12, 15],
    I: [16, 20, 25, 28, 30],
    N: [31, 35, null, 40, 45], // N[2] is the free space
    G: [46, 50, 55, 58, 60],
    O: [61, 65, 70, 72, 75],
  };

  it('should return 1 when no numbers matching grid are marked', () => { // Renamed from (TDD: Red)
    // Given: A grid and no drawn numbers (or none matching)
    const drawnNumbers = [80, 81, 82]; // Numbers outside the card

    // When: calculateMaxMarkedInLine is called
    const maxMarked = calculateMaxMarkedInLine(sampleGrid, drawnNumbers);

    // Then: The result should be 1 (because the free space always counts as marked in relevant lines)
    expect(maxMarked).toBe(1);
  });

  it('should return 0 when grid or drawnNumbers are invalid/null (Edge Case)', () => {
    // Given: Invalid inputs
    expect(calculateMaxMarkedInLine(null, [1, 2])).toBe(0);
    expect(calculateMaxMarkedInLine(undefined, [1, 2])).toBe(0);
    expect(calculateMaxMarkedInLine(sampleGrid, null)).toBe(0);
    expect(calculateMaxMarkedInLine(sampleGrid, undefined)).toBe(0);
    expect(calculateMaxMarkedInLine({}, [])).toBe(0); // Empty grid
  });

  it('should return the correct max marked count for partial matches', () => {
    // Given: Grid and some drawn numbers creating partial lines
    const drawnNumbers = [1, 16, 31, 46, 61]; // First number of each column
    // Expected: Max is 5 (Row 1: 1, 16, 31, 46, 61)
    expect(calculateMaxMarkedInLine(sampleGrid, drawnNumbers)).toBe(5); // Corrected expectation

    const drawnNumbers2 = [5, 20, 50, 70]; // Some scattered numbers
    // Expected:
    // Max marked in any line is 3 (Row 1: 5, 20, 50)
    expect(calculateMaxMarkedInLine(sampleGrid, drawnNumbers2)).toBe(3); // Corrected expectation

    const drawnNumbers3 = [1, 16, 40, 50, 61, 72]; // Causes 3 marks in a line
    // Diag 2: B[4]=?, I[3]=?, N[2]=FREE, G[1]=50, O[0]=61 -> Count 3
    expect(calculateMaxMarkedInLine(sampleGrid, drawnNumbers3)).toBe(3);

    const drawnNumbers4 = [1, 5, 10, 12, 15]; // Column B win
    // Expected: Should be 5 (tests winning line below, but confirms partial logic too)
    expect(calculateMaxMarkedInLine(sampleGrid, drawnNumbers4)).toBe(5);
  });

  it('should return 5 when a winning line is formed', () => {
    // Given: Grid and drawn numbers completing a line

    // Column B win
    const colBWin = [1, 5, 10, 12, 15, 99]; // 99 is extra
    expect(calculateMaxMarkedInLine(sampleGrid, colBWin)).toBe(5);

    // Row 3 win (using free space)
    const row3Win = [10, 25, 55, 70]; // B[2], I[2], N[2]=FREE, G[2], O[2]
    expect(calculateMaxMarkedInLine(sampleGrid, row3Win)).toBe(5);

    // Diagonal 1 win (top-left to bottom-right)
    const diag1Win = [1, 20, 58, 75]; // Corrected: B[0], I[1], N[2]=FREE, G[3]=58, O[4]=75
    expect(calculateMaxMarkedInLine(sampleGrid, diag1Win)).toBe(5);

    // Diagonal 2 win (top-right to bottom-left)
    const diag2Win = [15, 28, 50, 61]; // Corrected: B[4]=15, I[3]=28, N[2]=FREE, G[1]=50, O[0]=61
    expect(calculateMaxMarkedInLine(sampleGrid, diag2Win)).toBe(5);
  });
});

describe('checkLineWin', () => {
  // Use the renamed checkLineWin function
  // const { checkWinCondition } = require('../utils'); // Removed

  // Grid setup remains the same
  // ... (grid definition)
  const sampleGrid = {
    B: [1, 5, 10, 12, 15],
    I: [16, 20, 22, 25, 30],
    N: [31, 35, null, 40, 45],
    G: [46, 50, 55, 58, 60],
    O: [61, 65, 70, 72, 75],
  };

  it('should return null when no winning line exists', () => {
    // Given: Grid and drawn numbers with no winning line
    const drawnNumbers = new Set([1, 17, 33, 48, 62, 70]); // No complete line

    // When: checkLineWin is called
    const result = checkLineWin(sampleGrid, drawnNumbers);

    // Then: The result should be null
    expect(result).toBeNull();
  });

  it('should return null for invalid inputs (Edge Case)', () => {
     // Use checkLineWin for checks
     expect(checkLineWin(null, new Set([1, 2]))).toBeNull();
     expect(checkLineWin(undefined, new Set([1, 2]))).toBeNull();
     // Added more robust grid check
     expect(checkLineWin({}, new Set([1, 2]))).toBeNull(); // Empty grid object
     expect(checkLineWin({ B: [1], I: [], N: [], G: [], O: [] }, new Set([1, 2]))).toBeNull(); // Incomplete grid
     expect(checkLineWin(sampleGrid, null)).toBeNull();
     expect(checkLineWin(sampleGrid, undefined)).toBeNull();
     expect(checkLineWin(sampleGrid, new Set())).toBeNull(); // Empty drawn set
  });

  it('should return the winning sequence for a horizontal win', () => {
    // Row 0 win
    const drawn_r0 = new Set([1, 16, 31, 46, 61, 99, 88]); // Extra numbers included
    expect(checkLineWin(sampleGrid, drawn_r0)).toEqual([1, 16, 31, 46, 61]);

    // Row 2 win (includes FREE space)
    const drawn_r2 = new Set([10, 22, 40, 55, 70, 3, 9]);
    expect(checkLineWin(sampleGrid, drawn_r2)).toEqual([10, 22, null, 55, 70]);
  });

  it('should return the winning sequence for a vertical win', () => {
    // Column B win
    const drawn_cB = new Set([1, 5, 10, 12, 15, 99]);
    expect(checkLineWin(sampleGrid, drawn_cB)).toEqual([1, 5, 10, 12, 15]);

    // Column N win (includes FREE space)
    const drawn_cN = new Set([31, 35, 40, 45, 1, 2]);
    expect(checkLineWin(sampleGrid, drawn_cN)).toEqual([31, 35, null, 40, 45]);
  });

  it('should return the winning sequence for a diagonal win', () => {
    // Diagonal 1 win (top-left to bottom-right)
    // B[0]=1, I[1]=20, N[2]=null, G[3]=58, O[4]=75
    const drawn_d1 = new Set([1, 20, 58, 75, 99]); // Corrected 55->58, added extras
    expect(checkLineWin(sampleGrid, drawn_d1)).toEqual([1, 20, null, 58, 75]);

    // Diagonal 2 win (top-right to bottom-left)
    // O[0]=61, G[1]=50, N[2]=null, I[3]=25, B[4]=15
    const drawn_d2 = new Set([15, 25, 50, 61, 7]); // Corrected 55->50, added extras
    expect(checkLineWin(sampleGrid, drawn_d2)).toEqual([15, 25, null, 50, 61]);
  });

  it('should return the first winning line found if multiple exist', () => {
    // Both Row 0 and Column B win. Rows checked first.
    const drawn_multi = new Set([1, 5, 10, 12, 15, 16, 31, 46, 61]);
    // Expect Row 0 because rows are checked before columns/diagonals
    expect(checkLineWin(sampleGrid, drawn_multi)).toEqual([1, 16, 31, 46, 61]);
  });
});

// --- Tests for checkFullCardWin --- //
describe('checkFullCardWin', () => {
  // Use the checkFullCardWin function from utils
  // const { checkFullCardWin } = require('../utils'); // Already imported above

  // Helper grid (doesn't matter what numbers, just need the structure)
  const sampleGrid = {
    B: [1, 2, 3, 4, 5],
    I: [16, 17, 18, 19, 20],
    N: [31, 32, null, 34, 35],
    G: [46, 47, 48, 49, 50],
    O: [61, 62, 63, 64, 65],
  };

  // Helper function to flatten grid numbers (excluding null)
  const flattenGrid = (grid) => {
    return Object.values(grid).flat().filter(num => num !== null);
  };

  it('should return true if all numbers on the card (excluding free space) are in drawnNumbersSet', () => {
    // Given: A grid and a Set containing all numbers from that grid
    const allNumbers = flattenGrid(sampleGrid);
    const drawnNumbersSet = new Set(allNumbers);
    
    // When: checkFullCardWin is called
    const result = checkFullCardWin(sampleGrid, drawnNumbersSet);
    
    // Then: It should return true
    expect(result).toBe(true);
  });

  it('should return false if one number is missing from drawnNumbersSet', () => {
    // Given: A grid and a Set missing one number from the grid
    const allNumbers = flattenGrid(sampleGrid);
    const drawnNumbersSet = new Set(allNumbers);
    drawnNumbersSet.delete(sampleGrid.B[0]); // Remove the first B number
    
    // When: checkFullCardWin is called
    const result = checkFullCardWin(sampleGrid, drawnNumbersSet);
    
    // Then: It should return false
    expect(result).toBe(false);
  });

  it('should return false if multiple numbers are missing from drawnNumbersSet', () => {
    // Given: A grid and a Set missing several numbers
    const drawnNumbersSet = new Set([sampleGrid.B[0], sampleGrid.I[1], sampleGrid.G[2], sampleGrid.O[3]]);
    
    // When: checkFullCardWin is called
    const result = checkFullCardWin(sampleGrid, drawnNumbersSet);
    
    // Then: It should return false
    expect(result).toBe(false);
  });

  it('should return false if drawnNumbersSet is empty', () => {
    // Given: A grid and an empty Set
    const drawnNumbersSet = new Set();
    
    // When: checkFullCardWin is called
    const result = checkFullCardWin(sampleGrid, drawnNumbersSet);
    
    // Then: It should return false
    expect(result).toBe(false);
  });
  
  it('should return false if drawnNumbersSet contains numbers not on the card but misses some card numbers', () => {
    // Given: A grid and a Set with extra numbers but missing some grid numbers
    const allNumbers = flattenGrid(sampleGrid);
    const drawnNumbersSet = new Set(allNumbers);
    drawnNumbersSet.delete(sampleGrid.N[4]); // Remove a number
    drawnNumbersSet.add(100); // Add an extra number not on the card
    drawnNumbersSet.add(200);
    
    // When: checkFullCardWin is called
    const result = checkFullCardWin(sampleGrid, drawnNumbersSet);
    
    // Then: It should return false because a card number is missing
    expect(result).toBe(false);
  });

  it('should return true even if drawnNumbersSet contains extra numbers not on the card, as long as all card numbers ARE present', () => {
    // Given: A grid and a Set containing all grid numbers PLUS extra numbers
    const allNumbers = flattenGrid(sampleGrid);
    const drawnNumbersSet = new Set(allNumbers);
    drawnNumbersSet.add(100); // Add extra numbers
    drawnNumbersSet.add(200);
    
    // When: checkFullCardWin is called
    const result = checkFullCardWin(sampleGrid, drawnNumbersSet);
    
    // Then: It should return true because all required numbers are present
    expect(result).toBe(true);
  });
});