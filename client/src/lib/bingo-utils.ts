// import { BIP32Factory } from 'bip32'; // Removed
// import * as ecc from 'tiny-secp256k1'; // Removed
import { HDKey } from '@scure/bip32'; // Use @scure/bip32
import { Buffer } from 'buffer'; // Re-adding explicit import alongside ProvidePlugin
import crypto from 'crypto-browserify';

interface BingoGrid {
  B: number[];
  I: number[];
  N: (number | null)[];
  G: number[];
  O: number[];
}

interface BingoCardData {
  cardId: string;
  grid: BingoGrid;
}

/**
 * Derives a BIP32 public key for a given seed hash and index.
 * Uses the path m/44'/0'/0'/0/index.
 * 
 * @param seedHash - The seed hash (e.g., previous block hash) in hex format.
 * @param index - The derivation index (e.g., 1-based line number).
 * @returns The derived public key as a Buffer.
 */
export function derivePublicKey(seedHash: string, index: number): Buffer {
  if (!seedHash || typeof seedHash !== 'string' || seedHash.length === 0) {
    throw new Error('Invalid seedHash provided for key derivation.');
  }
  if (typeof index !== 'number' || index < 0) {
    throw new Error(`Invalid index provided for key derivation: ${index}`);
  }

  try {
    const seedBuffer = Buffer.from(seedHash, 'hex');
    // Use HDKey from @scure/bip32
    const root = HDKey.fromMasterSeed(seedBuffer);
    const derivationPath = `m/44'/0'/0'/0/${index}`;
    const child = root.derive(derivationPath);

    if (!child.publicKey) {
        throw new Error('Derived child key does not have a public key.')
    }

    console.log(`Derived public key for index ${index} using path ${derivationPath}`);
    // @scure/bip32 publicKey is Uint8Array, convert to Buffer
    return Buffer.from(child.publicKey);
  } catch (error: any) {
    console.error(`Error deriving public key for index ${index}:`, error);
    throw new Error(`Failed to derive public key for index ${index}: ${error.message}`);
  }
}

/**
 * Generates a deterministic 5x5 Bingo card from a public key using SHA-256 hashing.
 * B: 1–15, I: 16–30, N: 31–45, G: 46–60, O: 61–75. Center ('N'[2]) is free (null).
 * Numbers must be unique within each column.
 * 
 * @param publicKey - The public key (as a Buffer) used to seed card generation.
 * @returns An object containing a card ID and the 5x5 grid.
 */
export function generateBingoCard(publicKey: Buffer): BingoCardData {
  if (!publicKey || !Buffer.isBuffer(publicKey) || publicKey.length === 0) {
    throw new Error('Invalid publicKey provided for card generation.');
  }

  const cardId = `card-${publicKey.toString('hex').slice(-8)}`;
  const grid: BingoGrid = { B: [], I: [], N: [], G: [], O: [] };
  const ranges = {
    B: { min: 1, max: 15, size: 15 },
    I: { min: 16, max: 30, size: 15 },
    N: { min: 31, max: 45, size: 15 },
    G: { min: 46, max: 60, size: 15 },
    O: { min: 61, max: 75, size: 15 },
  } as const; // Use 'as const' for stricter type checking on keys

  let hash = crypto.createHash('sha256').update(publicKey).digest();
  let hashOffset = 0;

  function getNextHashInt(byteLength = 2): number {
    if (hashOffset + byteLength > hash.length) {
      console.log('Re-hashing for card generation...');
      // Include hashOffset in re-hash input for better entropy
      const rehashInput = Buffer.concat([hash, Buffer.from([hashOffset])]);
      hash = crypto.createHash('sha256').update(rehashInput).digest();
      hashOffset = 0;
    }
    const value = hash.readUIntBE(hashOffset, byteLength);
    hashOffset += byteLength;
    return value;
  }

  for (const col of ['B', 'I', 'N', 'G', 'O'] as const) { // Use 'as const' here too
    const usedInCol = new Set<number>();
    const range = ranges[col];
    
    while (grid[col].length < 5) {
      if (col === 'N' && grid[col].length === 2) {
        grid[col].push(null);
        continue;
      }

      let num: number;
      let attempts = 0;
      const maxAttempts = range.size * 5; // Safety break limit

      do {
        if (attempts >= maxAttempts) {
           throw new Error(`Could not generate unique number for column ${col} after ${maxAttempts} attempts.`);
        }
        const hashInt = getNextHashInt(2);
        num = (hashInt % range.size) + range.min;
        attempts++;
        if (attempts > range.size * 2 && !usedInCol.has(num)) {
          console.warn(`High attempt count (${attempts}) finding unique number for ${col}. Current hash offset: ${hashOffset}. Consider increasing hash re-seed complexity if this persists.`);
        }
      } while (usedInCol.has(num));

      grid[col].push(num);
      usedInCol.add(num);
    }
  }

  console.log(`Generated card grid for pubKey ending in ...${publicKey.toString('hex').slice(-8)}`);
  return { cardId, grid };
} 