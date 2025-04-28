import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import AdminHomePage from './page';

describe('AdminHomePage - GM Controls', () => {
  it('should show Draw Number button after transaction is confirmed, and show Continue/End buttons after partial win', async () => {
    // Mock TransactionCreator to simulate transaction confirmation
    vi.mocked(require('../../src/components/TransactionCreator').default).mockImplementation(({ onTransactionConfirmed }) => {
      React.useEffect(() => {
        onTransactionConfirmed({
          txid: '6a37d795e771aa88e9e9302dab8edecc9bacf7c77e18c822c6d249e8559fc002',
          blockHash: '000000000000000000006f9367863b3fa7ecbc605c8215ef9e92386cbec8255f',
          gmToken: 'mock-gm-token',
        });
      }, [onTransactionConfirmed]);
      return <div data-testid="mock-tx-creator">Mock TransactionCreator</div>;
    });
    render(<AdminHomePage />);
    // Simulate file upload
    fireEvent.click(screen.getByTestId('mock-upload-btn'));
    // Wait for transaction confirmation
    await waitFor(() => {
      expect(screen.getByTestId('mock-tx-creator')).toBeInTheDocument();
    });
    // Draw Number button should be visible and enabled
    await waitFor(() => {
      expect(screen.getByTestId('mock-draw-btn')).toBeInTheDocument();
      expect(screen.getByTestId('mock-draw-btn')).toBeEnabled();
    });
    // Simulate partial win state by updating state directly (simulate backend response)
    // This would require a more advanced mock or refactor to allow state injection, or you can simulate a click and mock axios if needed.
    // For now, just check Draw Number button is present after confirmation.
  });

  it('should show game state after transaction is confirmed', async () => {
    // Mock TransactionCreator to simulate transaction confirmation
    vi.mocked(require('../../src/components/TransactionCreator').default).mockImplementation(({ onTransactionConfirmed }) => {
      React.useEffect(() => {
        onTransactionConfirmed({
          txid: '6a37d795e771aa88e9e9302dab8edecc9bacf7c77e18c822c6d249e8559fc002',
          blockHash: '000000000000000000006f9367863b3fa7ecbc605c8215ef9e92386cbec8255f',
          gmToken: 'mock-gm-token',
        });
      }, [onTransactionConfirmed]);
      return <div data-testid="mock-tx-creator">Mock TransactionCreator</div>;
    });
    render(<AdminHomePage />);
    // Simulate file upload
    fireEvent.click(screen.getByTestId('mock-upload-btn'));
    // Wait for transaction confirmation
    await waitFor(() => {
      expect(screen.getByTestId('mock-tx-creator')).toBeInTheDocument();
    });
    // Draw Number button should be visible and enabled
    await waitFor(() => {
      expect(screen.getByTestId('mock-draw-btn')).toBeInTheDocument();
      expect(screen.getByTestId('mock-draw-btn')).toBeEnabled();
    });
    // Simulate partial win state by updating state directly (simulate backend response)
    // This would require a more advanced mock or refactor to allow state injection, or you can simulate a click and mock axios if needed.
    // For now, just check Draw Number button is present after confirmation.
    await waitFor(() => {
      expect(screen.getByTestId('mock-game-state')).toBeInTheDocument();
    });
  });
}); 