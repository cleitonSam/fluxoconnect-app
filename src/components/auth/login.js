// src/components/Login.js
import React, { useState } from 'react';
import './Login.css';

const Login = ({ onLogin, onSwitchToRegister, loading }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Por favor, preencha todos os campos');
      return;
    }

    try {
      const response = await onLogin(email, password);
      if (!response) {
        setError('Credenciais inválidas');
      }
    } catch (err) {
      setError('Erro ao fazer login. Tente novamente.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>FluxoConnect</h1>
          <p>Faça login para acessar sua conta</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="input-group">
            <label htmlFor="email">E-mail</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              disabled={loading}
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="password">Senha</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              disabled={loading}
            />
          </div>
          
          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Carregando...' : 'Entrar'}
          </button>
          
          <div className="switch-auth">
            <p>Não tem uma conta? <span onClick={onSwitchToRegister}>Crie uma</span></p>
          </div>
        </form>
        
        <div className="login-footer">
          <p>© 2024 FluxoConnect - Todos os direitos reservados</p>
        </div>
      </div>
    </div>
  );
};

export default Login;