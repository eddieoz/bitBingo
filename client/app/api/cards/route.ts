// Placeholder API route for generating bingo cards

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { BingoCardGrid, ApiCardResponse } from '@/types';

// Placeholder grid generation (should be replaced by actual deterministic logic on backend)
function generatePlaceholderGrid(startNum = 1): BingoCardGrid {
    const grid: any[][] = [];
    const ranges = [15, 30, 45, 60, 75]; // B I N G O
    let currentNumber = startNum;
    for (let col = 0; col < 5; col++) {
      const column: any[] = [];
      for (let row = 0; row < 5; row++) {
        if (col === 2 && row === 2) {
          column.push({ number: null, marked: true }); // Center FREE space
        } else {
          // Simple placeholder logic, does not adhere to BINGO rules perfectly
          const num = ((currentNumber - 1) % 75) + 1;
          column.push({ number: num, marked: false });
          currentNumber++;
        }
      }
      grid.push(column);
    }
    // Return as BingoCardGrid object
    return {
      B: grid[0],
      I: grid[1],
      N: grid[2],
      G: grid[3],
      O: grid[4],
    };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get('nickname');
  const blockHash = searchParams.get('blockHash');
  const indicesStr = searchParams.get('indices');

  if (!nickname || !blockHash || !indicesStr) {
    return NextResponse.json({ error: 'Missing required query parameters: nickname, blockHash, indices' }, { status: 400 });
  }

  const indices = indicesStr.split(',').map(Number).filter(n => !isNaN(n));

  if (indices.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty indices provided' }, { status: 400 });
  }

  console.log(`API: Generating cards for ${nickname}, block ${blockHash.substring(0,8)}, indices ${indices.join(',')}`);

  // --- TODO: Implement actual deterministic card generation --- 
  // 1. Use BIP32 with blockHash as seed and index as path to derive a key for each index.
  // 2. Use the derived key (or hash of it) to seed a PRNG (like a simple LCG or use a crypto library).
  // 3. Generate numbers for each column (B:1-15, I:16-30, etc.) using the PRNG, ensuring uniqueness within the column.
  // 4. Construct the BingoGrid.
  // --- End TODO ---

  try {
    // Simulate generation delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock card data for now
    const cards: ApiCardResponse[] = indices.map(index => ({
      cardIndex: index,
      grid: generatePlaceholderGrid(index * 10 + 1) // Generate slightly different mock grids
    }));

    return NextResponse.json(cards);

  } catch (error: any) {
    console.error("Error generating cards:", error);
    return NextResponse.json({ error: `Internal server error: ${error.message}` }, { status: 500 });
  }
} 