// src/components/Register.js
import React, { useState } from 'react';
import './Register.css';

const Register = ({ onRegister, onSwitchToLogin, loading }) => {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    confirmarSenha: '',
    instancia: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.nome || !formData.email || !formData.senha || !formData.confirmarSenha || !formData.instancia) {
      setError('Por favor, preencha todos os campos');
      return false;
    }

    if (formData.senha !== formData.confirmarSenha) {
      setError('As senhas não coincidem');
      return false;
    }

    if (formData.senha.length < 4) {
      setError('A senha deve ter pelo menos 4 caracteres');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Por favor, insira um email válido');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    try {
      // Gerar ID com timestamp
      const userData = {
        ...formData,
        id: Date.now().toString()
      };
      
      // Remover o campo de confirmação de senha antes de enviar
      delete userData.confirmarSenha;
      
      await onRegister(userData);
    } catch (err) {
      // Verificar se é o erro de e-mail já existente
      if (err.message === 'E-mail já cadastrado') {
        setError('Este e-mail já está cadastrado. Use outro e-mail ou faça login.');
      } else {
        setError('Erro ao criar conta. Tente novamente.');
      }
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <div className="register-header">
          <h1>Criar Conta</h1>
          <p>Preencha os dados abaixo para se registrar no FluxoConnect</p>
        </div>
        
        <form onSubmit={handleSubmit} className="register-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="input-group">
            <label htmlFor="nome">Nome Completo</label>
            <input
              type="text"
              id="nome"
              name="nome"
              value={formData.nome}
              onChange={handleChange}
              placeholder="Seu nome completo"
              disabled={loading}
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="email">E-mail</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="seu@email.com"
              disabled={loading}
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="instancia">Instância</label>
            <input
              type="text"
              id="instancia"
              name="instancia"
              value={formData.instancia}
              onChange={handleChange}
              placeholder="Nome da sua instância"
              disabled={loading}
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="senha">Senha</label>
            <input
              type="password"
              id="senha"
              name="senha"
              value={formData.senha}
              onChange={handleChange}
              placeholder="Crie uma senha"
              disabled={loading}
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="confirmarSenha">Confirmar Senha</label>
            <input
              type="password"
              id="confirmarSenha"
              name="confirmarSenha"
              value={formData.confirmarSenha}
              onChange={handleChange}
              placeholder="Digite novamente sua senha"
              disabled={loading}
            />
          </div>
          
          <button 
            type="submit" 
            className="register-button"
            disabled={loading}
          >
            {loading ? 'Criando conta...' : 'Criar Conta'}
          </button>
          
          <div className="switch-auth">
            <p>Já tem uma conta? <span onClick={onSwitchToLogin}>Faça login</span></p>
          </div>
        </form>
        
        <div className="register-footer">
          <p>© 2024 FluxoConnect - Todos os direitos reservados</p>
        </div>
      </div>
    </div>
  );
};

export default Register;