import React from 'react';

const TabNavigation = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'tachometer-alt' },
    { id: 'connect', label: 'Conectar WhatsApp', icon: 'whatsapp' },
    { id: 'groups', label: 'Todos os Grupos', icon: 'users' },
    { id: 'create-group', label: 'Criar Grupo', icon: 'plus-circle' },
    { id: 'schedule', label: 'Programar Mensagem', icon: 'clock' },
    { id: 'messages', label: 'Mensagens', icon: 'comment' },
  ];

  return (
    <div className="border-b border-gray-200">
      <nav className="flex overflow-x-auto -mb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center px-6 py-4 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <i className={`fas fa-${tab.icon} mr-2`}></i>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default TabNavigation;