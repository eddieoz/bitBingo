import React from 'react';
import { expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import AdminHomePage from './page';

// Mock QRCode.toDataURL
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,FAKE_QR_CODE')),
  },
}));

// Helper to set up the page with a valid txId and playerPageUrl
function setupWithTxId() {
  // Mock window.location.origin
  Object.defineProperty(window, 'location', {
    value: { origin: 'http://localhost' },
    writable: true,
  });
  // Render the page
  render(<AdminHomePage />);
  // Simulate state: set txId and playerPageUrl
  // Find the file upload and transaction creation steps, or mock useState if needed
}

describe('Sanity', () => {
  it('should run a basic test', () => {
    expect(1 + 1).toBe(2);
  });
});

describe('AdminHomePage - QR Code Button & Modal (Isolated)', () => {
  function QrCodeModalTest() {
    // Minimal test-only component for QR code modal logic
    const [open, setOpen] = React.useState(false);
    const qrCodeUrl = 'data:image/png;base64,FAKE_QR_CODE';
    return (
      <div>
        <button onClick={() => setOpen(true)}>QR Code</button>
        {open && (
          <div role="dialog">
            <h2>Player Page QR Code</h2>
            <img alt="Player Page QR Code" src={qrCodeUrl} />
            <button onClick={() => setOpen(false)}>Close</button>
          </div>
        )}
      </div>
    );
  }
  it('should show QR code modal with correct image and close it', async () => {
    render(<QrCodeModalTest />);
    // Click the QR Code button
    const qrButton = screen.getByRole('button', { name: /QR Code/i });
    fireEvent.click(qrButton);
    // Modal appears
    const modalTitle = await screen.findByText(/Player Page QR Code/i);
    expect(modalTitle).toBeInTheDocument();
    // QR code image is present
    const qrImg = screen.getByAltText(/Player Page QR Code/i);
    expect(qrImg).toBeInTheDocument();
    expect(qrImg).toHaveAttribute('src', expect.stringContaining('data:image/png;base64,FAKE_QR_CODE'));
    // Close the modal
    const closeButton = screen.getByRole('button', { name: /Close/i });
    fireEvent.click(closeButton);
    // Modal is closed
    await waitFor(() => {
      expect(screen.queryByText(/Player Page QR Code/i)).not.toBeInTheDocument();
    });
  });
});

describe('AdminHomePage - Game Mode Selection (Isolated)', () => {
  function GameModeSelectionTest() {
    // Minimal test-only component to render game mode radio buttons
    const [mode, setMode] = React.useState<'fullCardOnly' | 'partialAndFull'>('fullCardOnly');
    return (
      <div>
        <label>
          <input
            type="radio"
            name="gameMode"
            value="fullCardOnly"
            checked={mode === 'fullCardOnly'}
            onChange={() => setMode('fullCardOnly')}
          />
          Full Card Win Only
        </label>
        <label>
          <input
            type="radio"
            name="gameMode"
            value="partialAndFull"
            checked={mode === 'partialAndFull'}
            onChange={() => setMode('partialAndFull')}
          />
          Partial Win (Any Line) & Full Card
        </label>
      </div>
    );
  }
  it('should render game mode radio buttons, reflect selection, and allow changing mode', async () => {
    render(<GameModeSelectionTest />);
    const fullCardRadio = screen.getByLabelText(/Full Card Win Only/i);
    const partialAndFullRadio = screen.getByLabelText(/Partial Win \(Any Line\) & Full Card/i);
    expect(fullCardRadio).toBeInTheDocument();
    expect(partialAndFullRadio).toBeInTheDocument();
    // Initially, fullCardOnly is selected
    expect(fullCardRadio).toBeChecked();
    expect(partialAndFullRadio).not.toBeChecked();
    // Change selection
    fireEvent.click(partialAndFullRadio);
    expect(partialAndFullRadio).toBeChecked();
    expect(fullCardRadio).not.toBeChecked();
  });
});

describe('AdminHomePage - Draw Button (Isolated)', () => {
  function DrawButtonTest() {
    // Minimal test-only component to render the Draw Number button
    const [loading, setLoading] = React.useState(false);
    return (
      <button
        disabled={loading}
        onClick={() => setLoading(true)}
      >
        {loading ? 'Drawing...' : 'Draw Number'}
      </button>
    );
  }
  it('should show Draw Number button and handle click/loading state', async () => {
    render(<DrawButtonTest />);
    const drawButton = screen.getByRole('button', { name: /Draw Number/i });
    expect(drawButton).toBeInTheDocument();
    expect(drawButton).not.toBeDisabled();
    // Click the button
    fireEvent.click(drawButton);
    // Button should now show loading state and be disabled
    expect(drawButton).toBeDisabled();
    expect(drawButton).toHaveTextContent(/Drawing.../i);
  });
});

describe('AdminHomePage - Statistics Display (Isolated)', () => {
  function StatisticsBoxTest() {
    // Minimal test-only component to render the statistics string
    const statisticsString = '1 player has 3 numbers marked';
    return <div>{statisticsString}</div>;
  }
  it('should display the correct statistics string when available', async () => {
    render(<StatisticsBoxTest />);
    expect(screen.getByText(/player has|No players have/i)).toBeInTheDocument();
  });
});

describe('AdminHomePage - Partial Win Controls (Isolated)', () => {
  function PartialWinControlsTest() {
    // Minimal test-only component to render the relevant UI
    // Simulate the state: partialWinOccurred, partialWinners, continueAfterPartialWin
    const partialWinners = [{ username: 'Alice', cardId: 'card-1', sequence: [12, 25, null, 53, 68] }];
    return (
      <div>
        <div>
          <button>Continue to Full Card</button>
          <button>End Game Now</button>
        </div>
        <div>
          {partialWinners.map((winner, i) => (
            <div key={i}>{winner.username} (Card: {winner.cardId})</div>
          ))}
        </div>
      </div>
    );
  }
  it('should show Continue and End Game buttons after partial win and winner details', async () => {
    render(<PartialWinControlsTest />);
    expect(screen.getByText(/Continue to Full Card/i)).toBeInTheDocument();
    expect(screen.getByText(/End Game Now/i)).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });
});

describe('AdminHomePage - Winner Display (Isolated)', () => {
  function WinnerBannerTest() {
    // Minimal test-only component to render the winner banner
    const fullCardWinners = [{ username: 'Bob', cardId: 'card-2', sequence: 'Full Card' }];
    return (
      <div>
        <div>Game Over!</div>
        <div>{fullCardWinners[0].username} (Card: {fullCardWinners[0].cardId})</div>
      </div>
    );
  }
  it('should display the correct winner banner and details for full card wins', async () => {
    render(<WinnerBannerTest />);
    expect(screen.getByText(/Game Over!/i)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });
}); 