import React, { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Container, Row, Col, Card, Nav } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import FileUpload from './components/FileUpload';
import RaffleStatus from './components/RaffleStatus';
import TransactionCreator from './components/TransactionCreator';
import WinnerDisplay from './components/WinnerDisplay';
import Footer from './components/Footer';
import axios from 'axios';
import PlayPage from './pages/play-page/PlayPage'; // Import the actual PlayPage

// Use REACT_APP_ environment variable for the API URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Component containing the original App content (Admin View)
function AdminPage() {
  const [raffleState, setRaffleState] = useState({
    fileUploaded: false,
    fileHash: null,
    participantCount: 0,
    txId: null,
    txConfirmed: false,
    blockHash: null,
    winner: null,
    ipfsHash: null,
    loading: false,
    error: null,
    calculation: null
  });

  // Fetch initial status on component mount
  useEffect(() => {
    fetchRaffleStatus();
  }, []);

  const fetchRaffleStatus = async () => {
    try {
      setRaffleState(prevState => ({ ...prevState, loading: true }));
      const response = await axios.get(`${API_URL}/status`);
      setRaffleState(prevState => ({ 
        ...prevState, 
        ...response.data,
        loading: false 
      }));
    } catch (error) {
      console.error('Error fetching status:', error);
      setRaffleState(prevState => ({ 
        ...prevState, 
        loading: false,
        error: 'Failed to fetch raffle status' 
      }));
    }
  };

  const handleFileUploadSuccess = (data) => {
    setRaffleState(prevState => ({
      ...prevState,
      fileUploaded: true,
      fileHash: data.fileHash,
      participantCount: data.participantCount,
      ipfsHash: data.ipfsHash
    }));
  };

  const handleTransactionCreated = (data) => {
    setRaffleState(prevState => ({
      ...prevState,
      txId: data.txId
    }));
  };

  const handleTransactionConfirmed = (data) => {
    setRaffleState(prevState => ({
      ...prevState,
      txConfirmed: true,
      blockHash: data.blockHash
    }));
  };

  const handleWinnerCalculated = (data) => {
    setRaffleState(prevState => ({
      ...prevState,
      winner: data.winner,
      calculation: data.calculation
    }));
  };

  const handleReset = async () => {
    try {
      setRaffleState(prevState => ({ ...prevState, loading: true }));
      await axios.post(`${API_URL}/reset`);
      setRaffleState({
        fileUploaded: false,
        fileHash: null,
        participantCount: 0,
        txId: null,
        txConfirmed: false,
        blockHash: null,
        winner: null,
        ipfsHash: null,
        loading: false,
        error: null,
        calculation: null
      });
    } catch (error) {
      console.error('Error resetting raffle:', error);
      setRaffleState(prevState => ({
        ...prevState,
        loading: false,
        error: 'Failed to reset raffle'
      }));
    }
  };

  return (
    <Container>
      <header className="App-header my-4">
        <h1>bitBingo - Admin</h1>
        <p className="lead">Manage the Bingo Game Setup</p>
      </header>

      <Row className="mb-4">
        <Col>
          <RaffleStatus 
            raffleState={raffleState} 
            onRefresh={fetchRaffleStatus}
            onReset={handleReset}
          />
        </Col>
      </Row>

      <Row>
        <Col lg={6} className="mb-4">
          <Card className="h-100">
            <Card.Header>1. Upload Participant List</Card.Header>
            <Card.Body>
              <FileUpload 
                onUploadSuccess={handleFileUploadSuccess} 
                isDisabled={raffleState.fileUploaded}
                apiUrl={`${API_URL}/upload`}
              />
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6} className="mb-4">
          <Card className="h-100">
            <Card.Header>2. Submit Transaction Information</Card.Header>
            <Card.Body>
              <TransactionCreator 
                onTransactionCreated={handleTransactionCreated}
                onTransactionConfirmed={handleTransactionConfirmed}
                isDisabled={!raffleState.fileUploaded || raffleState.txId !== null}
                isConfirmed={raffleState.txConfirmed}
                fileHash={raffleState.fileHash}
                txId={raffleState.txId}
                blockHash={raffleState.blockHash}
                apiUrl={API_URL}
                onReset={handleReset}
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col className="mb-4">
          <Card>
            <Card.Header>3. Draw Winner (Old Raffle Logic)</Card.Header>
            <Card.Body>
              <WinnerDisplay 
                onWinnerCalculated={handleWinnerCalculated}
                isDisabled={!raffleState.txConfirmed || raffleState.winner !== null}
                blockHash={raffleState.blockHash}
                participantCount={raffleState.participantCount}
                winner={raffleState.winner}
                apiUrl={API_URL}
                onReset={handleReset}
                raffle={raffleState}
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

function App() {
  return (
    <div className="App">
      <Nav className="mb-3">
        <Nav.Item>
          <Nav.Link as={Link} to="/">Admin</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link as={Link} to="/play">Play</Nav.Link>
        </Nav.Item>
      </Nav>

      <Routes>
        <Route path="/" element={<AdminPage />} />
        <Route path="/play" element={<PlayPage />} />
        {/* Optional: Route to prefill block number, might need adjustment in PlayPage */}
        {/* <Route path="/play/:blockNumber" element={<PlayPage />} /> */}
      </Routes>
      
      <Footer />
    </div>
  );
}

export default App;
