import React from 'react';
// Removed Router/Link imports: import { Routes, Route, Link } from 'react-router-dom';
// Removed Bootstrap/Component imports if not needed globally here
import './App.css';
// Removed component imports: FileUpload, RaffleStatus, TransactionCreator, Footer, PlayPage, GameStateDisplay, DrawNumberButton
// Removed axios import

// API_URL might not be needed here anymore
// const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// --- REMOVED AdminPage FUNCTION --- 

function App() {
  // This component might just render children now if used in a layout,
  // or could be removed entirely if client/src/index.js directly mounts 
  // something else or if Next.js App Router is fully handling the root.
  // For now, just removing the Router setup.
  return (
    <div className="App">
      {/* Removed Nav Links */}
      {/* Removed <Routes> block */}
      {/* Removed <Footer /> */}
      {/* If this App component is still rendered, it needs content or structure */}
      {/* Placeholder content: */}
       {/* <p>App component loaded (Check console for routing)</p> */}
       {/* Usually, in App Router, this file isn't the main entry point */}
       {/* The actual content is rendered by layout.tsx and page.tsx files */}
    </div>
  );
}

export default App;
