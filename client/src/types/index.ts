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

// Define the structure for a winner object
export interface WinnerInfo {
  username: string;
  sequence: (number | string)[]; // Allow numbers or the string "FREE"
  cardId: string; // Add the card ID for the winning card
}

export interface GameState {
  drawnNumbers: number[];
  drawIndex: number;
  status?: string; // Added status back, was present in API response
  drawSequenceLength?: number; // Added from API response
  lastDrawTime?: number | null; // Added from API response
  isOver: boolean; // isOver is returned by the API
  winners?: WinnerInfo[] | null; // Ensure only one optional/nullable winners field exists
  statistics?: string; // Added from API response
  gameMode: string;
  partialWinOccurred: boolean;
  partialWinners: WinnerInfo[] | null;
  fullCardWinners: WinnerInfo[] | null;
}

// Structure for the logged-in user session on the PlayPage
export interface UserSession {
  nickname: string;
  cards: UserCardData[];
} 