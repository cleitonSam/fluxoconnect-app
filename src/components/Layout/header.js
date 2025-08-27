import React from 'react';

const Header = ({ user }) => {
  return (
    <header className="bg-white rounded-lg shadow-md py-4 px-6 flex justify-between items-center">
      <div className="flex items-center">
        <i className="fas fa-bolt text-primary text-2xl mr-3"></i>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          FluxConnect
        </h1>
      </div>
      
      <div className="text-gray-700">
        {user ? (
          <span>Conectado como <strong>{user.nome || 'Usuário'}</strong> | {user.email || 'E-mail não disponível'}</span>
        ) : (
          <span>Faça login para acessar o sistema</span>
        )}
      </div>
    </header>
  );
};

export default Header;