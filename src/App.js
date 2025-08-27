import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import Dashboard from './components/Dashboard/useProfile';
import Register from './components/auth/register';
import Login from './components/auth/login';
import './App.css';




function App() {
  const { user, loading, authMode, login, register, logout, switchAuthMode, checkEmailExists } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="App">
      {user ? (
        <Dashboard user={user} onLogout={logout} />
      ) : authMode === 'login' ? (
        <Login 
          onLogin={login} 
          onSwitchToRegister={() => switchAuthMode('register')}
          loading={loading} 
        />
      ) : (
        <Register 
          onRegister={register} 
          onSwitchToLogin={() => switchAuthMode('login')}
          loading={loading}
          checkEmailExists={checkEmailExists}
        />
      )}
    </div>
  );
}

export default App;