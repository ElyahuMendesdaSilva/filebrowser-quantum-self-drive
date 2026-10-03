import './App.css';
import { useState } from 'react';
import Dashboard from './views/Dashboard';
import Login from './views/Login';
import PublicShare from './views/PublicShare';
import { getToken, setToken } from './api/fileBrowser';

function App() {
  const [authenticated, setAuthenticated] = useState(Boolean(getToken()));
  const shareParams = window.location.hash.startsWith('#share?')
    ? new URLSearchParams(window.location.hash.slice('#share?'.length))
    : null;
  const publicShareHash = shareParams?.get('hash');

  function handleLogout() {
    setToken(null);
    window.history.replaceState({}, '', '/login');
    setAuthenticated(false);
  }

  return (
    <div className="App">
      {publicShareHash ? (
        <PublicShare hash={publicShareHash} />
      ) : authenticated ? (
        <Dashboard onLogout={handleLogout} />
      ) : (
        <Login onAuthenticated={() => setAuthenticated(true)} />
      )}
    </div>
  );
}

export default App;
