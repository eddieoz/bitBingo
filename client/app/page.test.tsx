import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import AdminHomePage from './page';

// Mock dependencies
vi.mock('../src/components/FileUpload', () => ({
  __esModule: true,
  default: ({ onUploadSuccess, isDisabled }) => (
    <button onClick={() => onUploadSuccess({
      filename: 'sample-tickets.csv',
      message: 'Upload successful',
      hexCid: 'bafkreifu3wf3vqz4u7uktze6te2lxb57ekwrg3ngdjl4ktgoag5jfwudgi',
      ipfsCid: 'bafkreifu3wf3vqz4u7uktze6te2lxb57ekwrg3ngdjl4ktgoag5jfwudgi',
      participantCount: 10
    })} disabled={isDisabled} data-testid="mock-upload-btn">Mock Upload</button>
  )
}));
vi.mock('../src/components/TransactionCreator', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-tx-creator">Mock TransactionCreator</div>
}));
vi.mock('../src/components/RaffleStatus', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-raffle-status">Mock RaffleStatus</div>
}));
vi.mock('../src/components/Footer', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-footer">Mock Footer</div>
}));
vi.mock('../src/components/GameStateDisplay', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-game-state">Mock GameStateDisplay</div>
}));
vi.mock('../src/components/DrawNumberButton', () => ({
  __esModule: true,
  default: ({ onDraw, isDisabled }) => (
    <button onClick={onDraw} disabled={isDisabled} data-testid="mock-draw-btn">Draw Number</button>
  )
}));

describe('AdminHomePage - Game Mode Selection', () => {
  it('should render game mode selection after file upload and allow toggling modes', async () => {
    render(<AdminHomePage />);
    // Simulate file upload
    const uploadBtn = screen.getByTestId('mock-upload-btn');
    fireEvent.click(uploadBtn);
    // Game mode radio buttons should appear
    await waitFor(() => {
      expect(screen.getByLabelText(/Full Card Win Only/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Partial Win/i)).toBeInTheDocument();
    });
    // Default selection is Full Card Win Only
    const fullCardRadio = screen.getByLabelText(/Full Card Win Only/i);
    const partialRadio = screen.getByLabelText(/Partial Win/i);
    expect(fullCardRadio).toBeChecked();
    expect(partialRadio).not.toBeChecked();
    // Toggle to Partial Win
    fireEvent.click(partialRadio);
    expect(partialRadio).toBeChecked();
    expect(fullCardRadio).not.toBeChecked();
    // Toggle back
    fireEvent.click(fullCardRadio);
    expect(fullCardRadio).toBeChecked();
    expect(partialRadio).not.toBeChecked();
  });
}); 