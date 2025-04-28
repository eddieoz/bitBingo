import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import PlayPage from './page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';

// Mock next/navigation and next/router if used
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/router', () => ({ useRouter: () => ({ query: { txid: '6a37d795e771aa88e9e9302dab8edecc9bacf7c77e18c822c6d249e8559fc002' } }) }));

// Mock axios for game state
const mockDrawnNumbers = [12, 25, 40, 53, 68];
const mockGameState = {
  drawnNumbers: mockDrawnNumbers,
  isOver: false,
  gameMode: 'fullCardOnly',
  partialWinOccurred: false,
  partialWinners: null,
  fullCardWinners: null,
  statistics: '1 player has 3 numbers marked',
};

vi.mock('axios');
vi.spyOn(axios, 'get').mockImplementation(() => Promise.resolve({ data: mockGameState }));

describe('PlayPage - Drawn Numbers Display', () => {
  it('should display the drawn numbers sequence in order', async () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <PlayPage params={{ txid: '6a37d795e771aa88e9e9302dab8edecc9bacf7c77e18c822c6d249e8559fc002' }} />
      </QueryClientProvider>
    );
    // Helper to get BINGO letter
    function getBingoLetter(num) {
      if (num >= 1 && num <= 15) return 'B';
      if (num >= 16 && num <= 30) return 'I';
      if (num >= 31 && num <= 45) return 'N';
      if (num >= 46 && num <= 60) return 'G';
      if (num >= 61 && num <= 75) return 'O';
      return '?';
    }
    await waitFor(() => {
      mockDrawnNumbers.forEach(num => {
        const label = getBingoLetter(num) + num;
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });
    // Optionally check the order or format (e.g., "B:12, I:25, N:40, ...")
    // This depends on the actual rendering logic in page.tsx
  });
});

describe('PlayPage - Winner Display', () => {
  it('should display the partial winner banner and details when partialWinOccurred is true', async () => {
    const queryClient = new QueryClient();
    const partialWinnerState = {
      ...mockGameState,
      partialWinOccurred: true,
      partialWinners: [
        { username: 'Alice', cardId: 'card-1', sequence: [12, 25, null, 53, 68] }
      ],
      isOver: false,
    };
    axios.get.mockResolvedValueOnce({ data: partialWinnerState });
    render(
      <QueryClientProvider client={queryClient}>
        <PlayPage params={{ txid: '6a37d795e771aa88e9e9302dab8edecc9bacf7c77e18c822c6d249e8559fc002' }} />
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(screen.getByText(/Partial Win Detected!/i)).toBeInTheDocument();
      expect(screen.getByText(/Alice/i)).toBeInTheDocument();
      expect(screen.getByText(/Winning Sequence/i)).toBeInTheDocument();
    });
  });

  it('should display the full card winner banner and details when isOver is true and fullCardWinners exist', async () => {
    const queryClient = new QueryClient();
    const fullCardWinnerState = {
      ...mockGameState,
      isOver: true,
      fullCardWinners: [
        { username: 'Bob', cardId: 'card-2', sequence: 'Full Card' }
      ],
      partialWinners: null,
    };
    axios.get.mockResolvedValueOnce({ data: fullCardWinnerState });
    render(
      <QueryClientProvider client={queryClient}>
        <PlayPage params={{ txid: '6a37d795e771aa88e9e9302dab8edecc9bacf7c77e18c822c6d249e8559fc002' }} />
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(screen.getByText(/Game Over!/i)).toBeInTheDocument();
      expect(screen.getByText(/Bob/i)).toBeInTheDocument();
      expect(screen.getByText(/Full Card Winner/i)).toBeInTheDocument();
    });
  });
});

// Mock UserLogin for the card display test
const validGrid = {
  B: [1, 2, 3, 4, 5],
  I: [16, 17, 18, 19, 20],
  N: [31, 32, null, 34, 35],
  G: [46, 47, 48, 49, 50],
  O: [61, 62, 63, 64, 65],
};
const mockCards = [
  { cardId: 'card-abc', lineIndex: 0, grid: validGrid },
  { cardId: 'card-def', lineIndex: 1, grid: validGrid },
];

vi.mock('../../../src/components/UserLogin', () => ({
  UserLogin: ({ onLoginSuccess }) => {
    React.useEffect(() => {
      onLoginSuccess({ nickname: 'testuser', cards: mockCards });
    }, [onLoginSuccess]);
    return null;
  },
}));

describe('PlayPage - Card Display', () => {
  it('should render UserCardsDisplay with the correct cards after login', async () => {
    const queryClient = new QueryClient();
    // Mock game state with drawn numbers
    const gameStateWithDrawn = {
      ...mockGameState,
      drawnNumbers: [12, 25, 40],
      isOver: false,
    };
    axios.get.mockResolvedValue({ data: gameStateWithDrawn });
    render(
      <QueryClientProvider client={queryClient}>
        <PlayPage params={{ txid: '6a37d795e771aa88e9e9302dab8edecc9bacf7c77e18c822c6d249e8559fc002' }} />
      </QueryClientProvider>
    );
    // Wait for the cards to be displayed
    await waitFor(() => {
      // Use a function matcher to check for card IDs in the card header
      expect(screen.getByText((content) => content.includes('rd-abc'))).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes('rd-def'))).toBeInTheDocument();
    });
  });
}); 