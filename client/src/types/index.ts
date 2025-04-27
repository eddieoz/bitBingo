// Define common types used in the application

// Data structure for a single bingo card
export interface BingoCardGrid {
  B: (number | null)[];
  I: (number | null)[];
  N: (number | null)[]; // Center might be null
  G: (number | null)[];
  O: (number | null)[];
}

export interface UserCardData {
  cardId: string;
  lineIndex: number;
  username: string;
  grid: BingoCardGrid;
}

// Structure for the game state fetched from the API
export interface GameStateStat {
  needed: number;
  count: number;
}

export interface GameState {
  drawnNumbers: number[];
  drawIndex: number;
  stats?: GameStateStat[] | null; // Optional stats for GM
  statsError?: string; // Optional error message if stats failed
}

// Structure for the logged-in user session on the PlayPage
export interface UserSession {
  nickname: string;
  cards: UserCardData[];
} 