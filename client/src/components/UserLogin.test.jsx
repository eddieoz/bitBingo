import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom'; // For extended matchers like .toBeInTheDocument()
import { UserLogin } from './UserLogin';
import axios from 'axios'; // Import axios to mock it

// Mock the axios module
vi.mock('axios'); 

// Helper to create mock card data
const createMockCard = (idSuffix) => ({
    cardId: `card-${idSuffix}`,
    username: 'testuser', 
    grid: { B: [1,2,3,4,5], I: [16,17,18,19,20], N: [31,32,null,34,35], G: [46,47,48,49,50], O: [61,62,63,64,65] }
});

describe('UserLogin Component', () => {
    const mockTxid = 'test-txid-123';
    const mockOnLoginSuccess = vi.fn();
    const mockOnLoginError = vi.fn();
    const nicknameToEnter = 'testuser';

    beforeEach(() => {
        // Clear mocks before each test
        vi.clearAllMocks();
        // Reset mock function calls
        mockOnLoginSuccess.mockClear();
        mockOnLoginError.mockClear();
    });

    test('Story: Render - displays nickname input and login button', () => {
        render(
            <UserLogin 
                txid={mockTxid} 
                onLoginSuccess={mockOnLoginSuccess} 
                onLoginError={mockOnLoginError} 
            />
        );

        // Check for Nickname Label and Input
        expect(screen.getByLabelText(/nickname/i)).toBeInTheDocument();
        
        // Check for Login Button (actual text is "View My Cards")
        expect(screen.getByRole('button', { name: /view my cards/i })).toBeInTheDocument();
    });

    test('Story: Successful Login - calls onLoginSuccess with session data on API success', async () => {
        // Arrange: Mock API response
        const mockCardsData = [createMockCard('abc'), createMockCard('def')];
        const mockApiResponse = { data: { cards: mockCardsData } };
        vi.mocked(axios.get).mockResolvedValue(mockApiResponse);

        render(
            <UserLogin 
                txid={mockTxid} 
                onLoginSuccess={mockOnLoginSuccess} 
                onLoginError={mockOnLoginError} 
            />
        );

        // Act: Simulate user input and button click
        const nicknameInput = screen.getByLabelText(/nickname/i);
        const loginButton = screen.getByRole('button', { name: /view my cards/i });

        fireEvent.change(nicknameInput, { target: { value: nicknameToEnter } });
        fireEvent.click(loginButton);

        // Assert: Check API call and callback
        await waitFor(() => {
            // Check axios was called correctly
            const expectedUrl = `/api/cards/${mockTxid}/${encodeURIComponent(nicknameToEnter)}`;
            // Note: We check if the URL *contains* the expected path because the 
            // component prepends the base URL (http://localhost:5000 or env var)
            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining(expectedUrl));

            // Check onLoginSuccess was called correctly
            expect(mockOnLoginSuccess).toHaveBeenCalledTimes(1);
            expect(mockOnLoginSuccess).toHaveBeenCalledWith({ 
                nickname: nicknameToEnter,
                cards: mockCardsData 
            });

            // Check onLoginError was not called
            expect(mockOnLoginError).not.toHaveBeenCalled();
        });
    });

    test('Story: Failed Login - calls onLoginError with message on API failure', async () => {
        // Arrange: Mock API to reject with a simple Error
        const errorMessage = 'Simulated API Error';
        vi.mocked(axios.get).mockRejectedValue(new Error(errorMessage)); // Simpler rejection

        render(
            <UserLogin 
                txid={mockTxid} 
                onLoginSuccess={mockOnLoginSuccess} 
                onLoginError={mockOnLoginError} 
            />
        );

        // Act: Simulate user input and button click
        const nicknameInput = screen.getByLabelText(/nickname/i);
        const loginButton = screen.getByRole('button', { name: /view my cards/i });

        fireEvent.change(nicknameInput, { target: { value: nicknameToEnter } });
        fireEvent.click(loginButton);

        // Assert: Check API call and callback
        await waitFor(() => {
            // Check axios was called correctly (still gets called)
            const expectedUrl = `/api/cards/${mockTxid}/${encodeURIComponent(nicknameToEnter)}`;
            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining(expectedUrl));

            // Check onLoginError was called correctly with the error message from the response
            expect(mockOnLoginError).toHaveBeenCalledTimes(1);
            expect(mockOnLoginError).toHaveBeenCalledWith(errorMessage); 

            // Check onLoginSuccess was not called
            expect(mockOnLoginSuccess).not.toHaveBeenCalled();
        });
    });
    
    test('Story: Loading State - shows loading state while API call is pending', async () => {
        // Arrange: Mock API to never resolve quickly
        const neverResolvingPromise = new Promise(() => {}); // A promise that never settles
        vi.mocked(axios.get).mockReturnValue(neverResolvingPromise);

        render(
            <UserLogin 
                txid={mockTxid} 
                onLoginSuccess={mockOnLoginSuccess} 
                onLoginError={mockOnLoginError} 
            />
        );

        // Act: Simulate user input and button click
        const nicknameInput = screen.getByLabelText(/nickname/i);
        const loginButton = screen.getByRole('button', { name: /view my cards/i });

        fireEvent.change(nicknameInput, { target: { value: nicknameToEnter } });
        fireEvent.click(loginButton);

        // Assert: Check for loading state immediately after click
        // Button should be disabled and show loading text/spinner
        expect(loginButton).toBeDisabled();
        expect(screen.getByRole('button', { name: /logging in.../i })).toBeInTheDocument();
        expect(screen.getByRole('status')).toBeInTheDocument(); // Find the spinner by its role

        // Make sure callbacks haven't been called yet
        expect(mockOnLoginSuccess).not.toHaveBeenCalled();
        expect(mockOnLoginError).not.toHaveBeenCalled();

        // Note: We don't need waitFor here as the loading state should be synchronous
        // We also don't need to wait for the neverResolvingPromise to settle.
    });

});

describe('UserLogin Component - Additional BDD Scenarios', () => {
    const validTxid = '6a37d795e771aa88e9e9302dab8edecc9bacf7c77e18c822c6d249e8559fc002';
    const mockOnLoginSuccess = vi.fn();
    const mockOnLoginError = vi.fn();
    const validNickname = 'testuser';

    beforeEach(() => {
        vi.clearAllMocks();
        mockOnLoginSuccess.mockClear();
        mockOnLoginError.mockClear();
    });

    test('Scenario: Invalid TXID - should call onLoginError with appropriate message', async () => {
        // The component always returns 'Login failed. Please try again.' for backend 404 errors (see UserLogin.jsx)
        const errorMessage = 'Login failed. Please try again.';
        vi.mocked(axios.get).mockRejectedValue({ response: { status: 404, data: { message: 'Invalid transaction ID' } } });
        render(
            <UserLogin 
                txid={'invalid-txid'} 
                onLoginSuccess={mockOnLoginSuccess} 
                onLoginError={mockOnLoginError} 
            />
        );
        fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: validNickname } });
        fireEvent.click(screen.getByRole('button', { name: /view my cards/i }));
        await waitFor(() => {
            expect(mockOnLoginError).toHaveBeenCalledWith(errorMessage);
            expect(mockOnLoginSuccess).not.toHaveBeenCalled();
        });
    });

    test('Scenario: Nickname Not Found - should call onLoginError with generic message', async () => {
        // The component always returns 'Login failed. Please try again.' for backend 404 errors (see UserLogin.jsx)
        const errorMessage = 'Login failed. Please try again.';
        vi.mocked(axios.get).mockRejectedValue({ response: { status: 404, data: { message: 'Nickname not found' } } });
        render(
            <UserLogin 
                txid={validTxid} 
                onLoginSuccess={mockOnLoginSuccess} 
                onLoginError={mockOnLoginError} 
            />
        );
        fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: 'unknownuser' } });
        fireEvent.click(screen.getByRole('button', { name: /view my cards/i }));
        await waitFor(() => {
            expect(mockOnLoginError).toHaveBeenCalledWith(errorMessage);
            expect(mockOnLoginSuccess).not.toHaveBeenCalled();
        });
    });

    test('Scenario: API/Network Error - should call onLoginError with generic error message', async () => {
        const errorMessage = 'Network Error';
        vi.mocked(axios.get).mockRejectedValue(new Error(errorMessage));
        render(
            <UserLogin 
                txid={validTxid} 
                onLoginSuccess={mockOnLoginSuccess} 
                onLoginError={mockOnLoginError} 
            />
        );
        fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: validNickname } });
        fireEvent.click(screen.getByRole('button', { name: /view my cards/i }));
        await waitFor(() => {
            expect(mockOnLoginError).toHaveBeenCalledWith(errorMessage);
            expect(mockOnLoginSuccess).not.toHaveBeenCalled();
        });
    });

    test('Scenario: Input Validation - should not call API or callbacks if nickname is empty', async () => {
        render(
            <UserLogin 
                txid={validTxid} 
                onLoginSuccess={mockOnLoginSuccess} 
                onLoginError={mockOnLoginError} 
            />
        );
        const loginButton = screen.getByRole('button', { name: /view my cards/i });
        fireEvent.change(screen.getByLabelText(/nickname/i), { target: { value: '' } });
        fireEvent.click(loginButton);
        // Optionally, check for validation message in UI
        expect(mockOnLoginSuccess).not.toHaveBeenCalled();
        expect(mockOnLoginError).not.toHaveBeenCalled();
        // Optionally, check for error message in the UI
        // expect(screen.getByText(/please enter a nickname/i)).toBeInTheDocument();
    });
}); 