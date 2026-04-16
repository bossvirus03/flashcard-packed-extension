import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { AuthScreen } from './components/AuthScreen';
import { DashboardScreen } from './components/DashboardScreen';
import './styles/popup.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    chrome.storage.local.get(['authToken', 'user'], (data) => {
      if (data.authToken && data.user) {
        setUser(data.user);
        setIsAuthenticated(true);
      }
      setLoading(false);
    });
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    chrome.storage.local.remove(['authToken', 'user']);
    setUser(null);
    setIsAuthenticated(false);
  };

  if (loading) {
    return <div className="container">Loading...</div>;
  }

  return (
    <div className="app">
      {isAuthenticated ? (
        <DashboardScreen user={user} onLogout={handleLogout} />
      ) : (
        <AuthScreen onLogin={handleLogin} />
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
