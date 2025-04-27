import React from 'react';
// import ReactDOM from 'react-dom/client'; // Remove ReactDOM
// import { BrowserRouter } from 'react-router-dom'; // Remove Router
import './index.css';
// import App from './App.jsx'; // Remove App import
import reportWebVitals from './reportWebVitals';
import 'bootstrap/dist/css/bootstrap.min.css';

// --- BEGIN ADDITION: Global Buffer Polyfill ---
import { Buffer } from 'buffer';
window.Buffer = Buffer;
// --- END ADDITION ---

// --- REMOVED ReactDOM.createRoot and root.render --- 
/*
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
*/

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
