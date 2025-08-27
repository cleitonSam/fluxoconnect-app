// src/components/Dashboard.js
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './Dashboard.css';

const Dashboard = ({ user, onLogout }) => {
  // Estados principais
  const [qrCode, setQrCode] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(user.whatsappStatus || 'Desconectado');
  const [instanceCreated, setInstanceCreated] = useState(false);
  const [statusCheckInterval, setStatusCheckInterval] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [instanceExists, setInstanceExists] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [instanceInfo, setInstanceInfo] = useState(null);
  
  // Estados para grupos
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupParticipants, setNewGroupParticipants] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [selectedGroupForDetails, setSelectedGroupForDetails] = useState(null);
  const [groupDetails, setGroupDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Estados para mensagens
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendingStatus, setSendingStatus] = useState('');
  const [selectedGroupForBulk, setSelectedGroupForBulk] = useState('');
  const [isSendingToParticipants, setIsSendingToParticipants] = useState(false);

  // Constantes para controle de delay inteligente
  const MESSAGE_DELAY = {
    MIN: 800,       // Delay mínimo entre mensagens (ms)
    MAX: 1500,      // Delay máximo entre mensagens (ms)
    BATCH_SIZE: 5,  // Quantidade de mensagens per lote
    BATCH_DELAY: 3000 // Delay entre lotes (ms)
  };

  const API_BASE_URL = 'https://evo.fluxodigitaltech.com.br';
  const API_KEY = user.apiKey || 'lcV71zmct4xwueG7nd7y0uw9mcAOYBTKN3EbAu/1OIXU2QKYvmILUAFlhF2WoclioIvoL1fORjBaFrX0TWqY3g==';

  // Efeitos
  useEffect(() => {
    checkInstanceStatus();
    
    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
    };
  }, []);

  useEffect(() => {
    if (user.firstLogin && user.whatsappStatus !== 'Conectado' && !instanceCreated) {
      createInstanceAndGenerateQR();
    }
  }, [user, instanceCreated]);

  useEffect(() => {
    if (activeTab === 'groups' && connectionStatus === 'Conectado') {
      loadGroups();
    }
  }, [activeTab, connectionStatus]);

  useEffect(() => {
    if (activeTab === 'messages' && connectionStatus === 'Conectado') {
      loadContacts();
    }
  }, [activeTab, connectionStatus]);

  // Funções utilitárias
  const getRandomDelay = () => {
    return Math.floor(Math.random() * (MESSAGE_DELAY.MAX - MESSAGE_DELAY.MIN + 1)) + MESSAGE_DELAY.MIN;
  };

  const validateAndFormatPhoneNumber = (number) => {
    if (!number) return null;
    let formattedNumber = number.replace(/[^\d@\.\-]/g, '');
    if (!/^\d+/.test(formattedNumber)) return null;
    return formattedNumber;
  };

  // Função para exportar contatos para Excel
  const exportGroupContactsToExcel = async (groupJid) => {
    if (!groupJid) return;
    
    setIsExporting(true);
    try {
      // Buscar detalhes do grupo com participantes
      const response = await fetch(
        `${API_BASE_URL}/group/findGroupInfos/${user.instancia}?groupJid=${encodeURIComponent(groupJid)}`,
        { headers: { 'apikey': API_KEY } }
      );

      if (!response.ok) {
        throw new Error('Erro ao buscar detalhes do grupo');
      }

      const groupDetails = await response.json();
      const participants = groupDetails.participants || [];

      if (participants.length === 0) {
        alert('Nenhum participante encontrado no grupo');
        return;
      }

      // Preparar dados para exportação
      const exportData = participants.map(participant => ({
        'Número': participant.id.split('@')[0],
        'ID Completo': participant.id,
        'Cargo': participant.admin === 'superadmin' ? 'Dono' : 
                 participant.admin === 'admin' ? 'Admin' : 'Membro',
        'Nome do Grupo': groupDetails.subject || 'Sem nome',
        'ID do Grupo': groupDetails.id,
        'Data Exportação': new Date().toLocaleDateString('pt-BR')
      }));

      // Criar planilha Excel
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Contatos do Grupo');
      
      // Gerar arquivo
      const fileName = `contatos-${groupDetails.subject || 'grupo'}-${new Date().getTime()}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      alert(`✅ ${participants.length} contatos exportados com sucesso!`);
    } catch (error) {
      console.error('Erro ao exportar contatos:', error);
      alert('❌ Erro ao exportar contatos: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Funções da API
  const checkConnectionState = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/instance/connectionState/${user.instancia}`, {
        headers: { 'apikey': API_KEY }
      });
      
      if (response.ok) {
        const data = await response.json();
        const connectionState = data.instance?.state;
        
        if (connectionState === 'open') {
          setConnectionStatus('Conectado');
          setInstanceCreated(true);
          setQrCode(null);
        } else if (connectionState === 'close') {
          setConnectionStatus('Desconectado');
        }
        return connectionState;
      } else {
        setConnectionStatus('Erro ao verificar conexão');
        return null;
      }
    } catch (error) {
      setConnectionStatus('Erro ao verificar conexão');
      return null;
    }
  };

  const checkInstanceStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/instance/connect/${user.instancia}`, {
        headers: { 'apikey': API_KEY }
      });
      
      if (response.ok) {
        const data = await response.json();
        setInstanceInfo(data);
        setInstanceExists(true);
        await checkConnectionState();
      } else if (response.status === 404) {
        setConnectionStatus('Desconectado');
        setInstanceExists(false);
        setInstanceInfo(null);
      } else {
        await checkConnectionState();
      }
    } catch (error) {
      await checkConnectionState();
      setInstanceExists(false);
    }
  };

  const getQRCode = async () => {
    try {
      const qrResponse = await fetch(`${API_BASE_URL}/instance/connect/${user.instancia}`, {
        method: 'GET',
        headers: { 'apikey': API_KEY }
      });
      
      if (qrResponse.ok) {
        const qrData = await qrResponse.json();
        if (qrData.pairingCode || qrData.code || qrData.qrcode || qrData.base64) {
          if (qrData.code) setQrCode(qrData.code);
          else if (qrData.qrcode) setQrCode(qrData.qrcode);
          else if (qrData.base64) setQrCode(qrData.base64);
          else if (qrData.pairingCode) setQrCode(qrData.pairingCode);
          setConnectionStatus('Aguardando conexão');
        } else {
          const connectionState = await checkConnectionState();
          if (connectionState === 'open') {
            setConnectionStatus('Conectado');
            setInstanceCreated(true);
            setQrCode(null);
          }
        }
      }
    } catch (error) {
      await checkInstanceStatus();
    }
  };

  const createInstanceAndGenerateQR = async () => {
    setIsConnecting(true);
    try {
      const formattedNumber = validateAndFormatPhoneNumber(phoneNumber);
      const requestData = {
        instanceName: user.instancia,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true
      };
      
      if (formattedNumber) requestData.number = formattedNumber;
      if (user.webhook) requestData.webhook = user.webhook;
      
      const createResponse = await fetch(`${API_BASE_URL}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY
        },
        body: JSON.stringify(requestData)
      });
      
      if (createResponse.ok) {
        setInstanceCreated(true);
        setInstanceExists(true);
        await getQRCode();
        startStatusChecking();
      }
    } catch (error) {
      setConnectionStatus('Erro na conexão: ' + error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const startStatusChecking = () => {
    if (statusCheckInterval) clearInterval(statusCheckInterval);
    
    const interval = setInterval(async () => {
      const connectionState = await checkConnectionState();
      if (connectionState === 'open') {
        clearInterval(interval);
        setConnectionStatus('Conectado');
        setInstanceCreated(true);
        setQrCode(null);
      }
    }, 5000);
    setStatusCheckInterval(interval);
  };

  const manuallyConnectWhatsApp = async () => {
    setIsConnecting(true);
    try {
      await checkInstanceStatus();
      if (instanceExists) {
        const connectionState = await checkConnectionState();
        if (connectionState === 'open') {
          setConnectionStatus('Conectado');
          setInstanceCreated(true);
          setQrCode(null);
        } else {
          await getQRCode();
          startStatusChecking();
        }
      } else {
        await createInstanceAndGenerateQR();
      }
    } catch (error) {
      setConnectionStatus('Erro na conexão: ' + error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const deleteInstance = async () => {
    if (!window.confirm('Tem certeza que deseja deletar esta instância? Esta ação não pode ser desfeita.')) return;
    
    setIsDeleting(true);
    try {
      const deleteResponse = await fetch(`${API_BASE_URL}/instance/delete/${user.instancia}`, {
        method: 'DELETE',
        headers: { 'apikey': API_KEY }
      });
      
      if (deleteResponse.ok) {
        setConnectionStatus('Desconectado');
        setInstanceExists(false);
        setQrCode(null);
        setInstanceCreated(false);
        setInstanceInfo(null);
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
          setStatusCheckInterval(null);
        }
      }
    } catch (error) {
      console.error('Erro ao deletar instância:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Funções para grupos
  const loadGroups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/group/fetchAllGroups/${user.instancia}?getParticipants=true`, {
        headers: { 'apikey': API_KEY }
      });
      
      if (response.ok) {
        const data = await response.json();
        setGroups(data || []);
      } else {
        setGroups([]);
      }
    } catch (error) {
      setGroups([]);
    }
  };

  const loadGroupDetails = async (groupJid) => {
    setIsLoadingDetails(true);
    setSelectedGroupForDetails(groupJid);
    try {
      const response = await fetch(
        `${API_BASE_URL}/group/findGroupInfos/${user.instancia}?groupJid=${encodeURIComponent(groupJid)}`,
        { headers: { 'apikey': API_KEY } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setGroupDetails(data);
      } else {
        setGroupDetails(null);
      }
    } catch (error) {
      setGroupDetails(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) {
      alert('Por favor, digite um nome para o grupo');
      return;
    }

    if (newGroupParticipants.length === 0) {
      alert('Por favor, adicione pelo menos um número de participante');
      return;
    }

    const invalidNumbers = newGroupParticipants.filter(number => !/^(\d+|\d+@.+\..+)$/.test(number));
    if (invalidNumbers.length > 0) {
      alert(`Os seguintes números têm formato inválido: ${invalidNumbers.join(', ')}`);
      return;
    }

    setIsCreatingGroup(true);
    try {
      const response = await fetch(`${API_BASE_URL}/group/create/${user.instancia}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY
        },
        body: JSON.stringify({
          subject: newGroupName,
          participants: newGroupParticipants
        })
      });

      if (response.ok) {
        setNewGroupName('');
        setNewGroupParticipants([]);
        alert('Grupo criado com sucesso!');
        await loadGroups();
      }
    } catch (error) {
      alert('Erro ao criar grupo: ' + error.message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Funções para mensagens
  const loadContacts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/fetchContacts/${user.instancia}`, {
        headers: { 'apikey': API_KEY }
      });
      
      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts || []);
      }
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
    }
  };

  // Função para enviar mensagem com proteção contra bloqueio
  const sendMessageWithProtection = async (number, messageText, options = {}) => {
    const {
      delay = 800,
      presence = "composing",
      retryCount = 0,
      maxRetries = 2
    } = options;

    try {
      const response = await fetch(`${API_BASE_URL}/message/sendText/${user.instancia}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY
        },
        body: JSON.stringify({
          number,
          text: messageText,
          delay,
          presence
        })
      });

      if (response.ok) {
        return { success: true };
      } else {
        const errorData = await response.json();
        
        // Se for erro de rate limiting, aguardar e tentar novamente
        if (response.status === 429 && retryCount < maxRetries) {
          const retryDelay = Math.pow(2, retryCount) * 2000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return sendMessageWithProtection(number, messageText, { 
            ...options, 
            retryCount: retryCount + 1 
          });
        }
        
        return { 
          success: false, 
          error: errorData.message || 'Erro desconhecido',
          status: response.status
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  };

  // Versão melhorada da função sendMessage
  const sendMessage = async () => {
    if (!message.trim()) {
      alert('Por favor, digite uma mensagem');
      return;
    }

    setIsSending(true);
    setSendingStatus('Enviando mensagens...');

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // Enviar para grupos selecionados
      if (selectedGroup) {
        const result = await sendMessageWithProtection(selectedGroup, message, {
          delay: 1800,
          presence: "composing"
        });

        if (result.success) {
          successCount++;
        } else {
          errors.push(`Grupo: ${result.error}`);
          errorCount++;
        }
      }

      // Enviar para contatos selecionados
      for (let i = 0; i < selectedContacts.length; i++) {
        const contact = selectedContacts[i];
        setSendingStatus(`Enviando para contato ${i + 1} de ${selectedContacts.length}...`);

        const result = await sendMessageWithProtection(contact, message, {
          delay: 1800,
          presence: "composing"
        });

        if (result.success) {
          successCount++;
        } else {
          errors.push(`Contato ${contact}: ${result.error}`);
          errorCount++;
        }

        // Delay entre mensagens para contatos
        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
      }

      setSendingStatus(`Mensagens enviadas: ${successCount} com sucesso, ${errorCount} com erro`);
      
      if (errors.length > 0) {
        setSendingStatus(prev => prev + `. Erros: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
      }
      
      // Limpar apenas se tudo foi bem sucedido
      if (errorCount === 0) {
        setMessage('');
        setSelectedContacts([]);
        setSelectedGroup('');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagens:', error);
      setSendingStatus('Erro ao enviar mensagens: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  // Função melhorada para enviar mensagem para todos os participantes
  const sendMessageToAllParticipants = async (groupJid, messageText) => {
    setIsSendingToParticipants(true);
    setSendingStatus('Buscando participantes do grupo...');

    try {
      // Primeiro, buscar os detalhes do grupo para obter a lista de participantes
      const groupDetailsResponse = await fetch(
        `${API_BASE_URL}/group/findGroupInfos/${user.instancia}?groupJid=${encodeURIComponent(groupJid)}`,
        { headers: { 'apikey': API_KEY } }
      );

      if (!groupDetailsResponse.ok) {
        throw new Error('Erro ao buscar detalhes do grupo');
      }

      const groupDetails = await groupDetailsResponse.json();
      const participants = groupDetails.participants || [];

      if (participants.length === 0) {
        setSendingStatus('Nenhum participante encontrado no grupo');
        return;
      }

      setSendingStatus(`Preparando envio para ${participants.length} participantes...`);

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // Enviar em lotes para evitar bloqueio
      for (let batchIndex = 0; batchIndex < participants.length; batchIndex += MESSAGE_DELAY.BATCH_SIZE) {
        const batch = participants.slice(batchIndex, batchIndex + MESSAGE_DELAY.BATCH_SIZE);
        
        setSendingStatus(`Enviando lote ${Math.floor(batchIndex / MESSAGE_DELAY.BATCH_SIZE) + 1} de ${Math.ceil(participants.length / MESSAGE_DELAY.BATCH_SIZE)}...`);

        // Enviar mensagens do lote
        for (let i = 0; i < batch.length; i++) {
          const participant = batch[i];
          const participantNumber = batchIndex + i + 1;
          
          setSendingStatus(`Enviando para participante ${participantNumber} de ${participants.length}...`);

          try {
            const result = await sendMessageWithProtection(participant.id, messageText, {
              delay: 800,
              presence: "composing"
            });

            if (result.success) {
              successCount++;
            } else {
              errors.push(`Participante ${participant.id}: ${result.error || 'Erro desconhecido'}`);
              errorCount++;
              
              // Se houver muitos erros, parar o envio
              if (errorCount > 10) {
                throw new Error('Muitos erros consecutivos. Parando envio para evitar bloqueio.');
              }
            }
          } catch (error) {
            errors.push(`Participante ${participant.id}: ${error.message}`);
            errorCount++;
            
            if (errorCount > 10) {
              throw new Error('Muitos erros consecutivos. Parando envio para evitar bloqueio.');
            }
          }

          // Delay aleatório entre mensagens
          const delay = getRandomDelay();
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Delay entre lotes (maior)
        if (batchIndex + MESSAGE_DELAY.BATCH_SIZE < participants.length) {
          setSendingStatus(`Aguardando ${MESSAGE_DELAY.BATCH_DELAY/1000} segundos antes do próximo lote...`);
          await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY.BATCH_DELAY));
        }
      }

      // Resultado final
      if (errorCount === 0) {
        setSendingStatus(`✅ Mensagens enviadas para todos os ${successCount} participantes com sucesso!`);
      } else {
        setSendingStatus(
          `📊 Resultado: ${successCount} enviadas, ${errorCount} com erro. ` +
          `Primeiros erros: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`
        );
      }

    } catch (error) {
      console.error('Erro ao enviar para participantes:', error);
      setSendingStatus('❌ Erro: ' + error.message);
    } finally {
      setIsSendingToParticipants(false);
    }
  };

  // Render functions
  const renderQRCode = () => {
    if (!qrCode) return null;
    if (qrCode.startsWith('data:image') || qrCode.startsWith('http')) {
      return <img src={qrCode} alt="QR Code para conexão do WhatsApp" />;
    } else {
      return (
        <img 
          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`} 
          alt="QR Code para conexão do WhatsApp" 
        />
      );
    }
  };

  const renderConnectionButton = () => {
    if (connectionStatus === 'Conectado') {
      return (
        <button onClick={deleteInstance} className="btn btn-danger" disabled={isDeleting}>
          {isDeleting ? <><span className="spinner"></span>Desconectando...</> : 'Desconectar WhatsApp'}
        </button>
      );
    } else {
      return (
        <button onClick={manuallyConnectWhatsApp} className="btn btn-primary" disabled={isConnecting}>
          {isConnecting ? <><span className="spinner"></span>Conectando...</> : 'Conectar WhatsApp'}
        </button>
      );
    }
  };

  // Modal de detalhes do grupo
  const GroupDetailsModal = () => {
    if (!selectedGroupForDetails) return null;

    return (
      <div className="modal-overlay" onClick={() => setSelectedGroupForDetails(null)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>
              {isLoadingDetails ? 'Carregando...' : `Detalhes do Grupo: ${groupDetails?.subject || 'Sem nome'}`}
            </h3>
            <button onClick={() => setSelectedGroupForDetails(null)} className="modal-close">×</button>
          </div>
          
          <div className="modal-body">
            {isLoadingDetails ? (
              <div className="loading-modal">
                <div className="spinner"></div>
                <p>Carregando informações do grupo...</p>
              </div>
            ) : groupDetails ? (
              <>
                <div className="group-info-section">
                  <h4>Informações do Grupo</h4>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>ID do Grupo:</label>
                      <span className="group-id">{groupDetails.id}</span>
                    </div>
                    <div className="info-item">
                      <label>Proprietário:</label>
                      <span>{groupDetails.owner || 'Não informado'}</span>
                    </div>
                    <div className="info-item">
                      <label>Total de Membros:</label>
                      <span>{groupDetails.size || 0}</span>
                    </div>
                    <div className="info-item">
                      <label>Criado em:</label>
                      <span>
                        {groupDetails.creation 
                          ? new Date(groupDetails.creation * 1000).toLocaleDateString('pt-BR')
                          : 'Data desconhecida'
                        }
                      </span>
                    </div>
                    {groupDetails.desc && (
                      <div className="info-item full-width">
                        <label>Descrição:</label>
                        <span className="group-description">{groupDetails.desc}</span>
                      </div>
                    )}
                  </div>
                </div>

                {groupDetails.participants && groupDetails.participants.length > 0 && (
                  <div className="participants-section">
                    <h4>Participantes ({groupDetails.participants.length})</h4>
                    <div className="participants-list">
                      {groupDetails.participants.map((participant, index) => (
                        <div key={index} className="participant-item">
                          <span className="participant-id">{participant.id}</span>
                          <span className={`participant-role ${participant.admin || 'member'}`}>
                            {participant.admin === 'superadmin' ? 'Dono' : 
                             participant.admin === 'admin' ? 'Admin' : 'Membro'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="modal-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      setActiveTab('messages');
                      setSelectedGroup(groupDetails.id);
                      setSelectedContacts([]);
                      setSelectedGroupForDetails(null);
                    }}
                  >
                    💬 Enviar Mensagem para este Grupo
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => {
                      setActiveTab('messages');
                      setSelectedGroupForBulk(groupDetails.id);
                      setSelectedGroupForDetails(null);
                    }}
                  >
                    📨 Enviar para Todos os Participantes
                  </button>
                  <button 
                    className="btn btn-success"
                    onClick={() => exportGroupContactsToExcel(groupDetails.id)}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <><span className="spinner"></span> Exportando...</>
                    ) : (
                      '📊 Exportar Contatos (Excel)'
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="error-state">
                <p>Erro ao carregar detalhes do grupo.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render content based on active tab
  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <>
            <div className="row">
              <div className="col-4">
                <div className="status-card">
                  <div className="card-icon primary"><span>📱</span></div>
                  <div className="card-details">
                    <h3>Status da Instância</h3>
                    <p className={instanceExists ? 'status-active' : 'status-inactive'}>
                      {instanceExists ? 'Ativa' : 'Inativa'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="col-4">
                <div className="status-card">
                  <div className="card-icon secondary"><span>🔗</span></div>
                  <div className="card-details">
                    <h3>Conexão WhatsApp</h3>
                    <p className={`status-${connectionStatus === 'Conectado' ? 'active' : 
                                  connectionStatus === 'Aguardando conexão' ? 'waiting' : 'inactive'}`}>
                      {connectionStatus}
                    </p>
                  </div>
                </div>
              </div>
              <div className="col-4">
                <div className="status-card">
                  <div className="card-icon tertiary"><span>👤</span></div>
                  <div className="card-details">
                    <h3>Status da Conta</h3>
                    <p className="status-active">Ativa</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2>Conexão WhatsApp</h2>
                <div className="connection-status">
                  <span className={`status-indicator ${
                    connectionStatus === 'Conectado' ? 'connected' : 
                    connectionStatus === 'Aguardando conexão' ? 'waiting' : 
                    'disconnected'
                  }`}></span>
                  {connectionStatus}
                </div>
              </div>
              <div className="panel-body">
                <div className="connection-actions">
                  {renderConnectionButton()}
                  
                  <div className="connection-config">
                    <h4>Configurações de Conexão</h4>
                    <div className="form-group">
                      <label htmlFor="phoneNumber">Número do WhatsApp (opcional):</label>
                      <input
                        type="text"
                        id="phoneNumber"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="5511999999999 (apenas números, @, ., ou -)"
                      />
                      <small className="input-help">
                        Formato aceito: deve começar com números e pode conter @, . ou - depois.
                        Ex: 5511999999999 ou 5511999999999@s.whatsapp.net
                      </small>
                    </div>
                  </div>
                </div>

                {qrCode && connectionStatus === 'Aguardando conexão' && (
                  <div className="qr-section">
                    <h3>Escaneie o QR Code para conectar o WhatsApp</h3>
                    <div className="qr-code-container">{renderQRCode()}</div>
                    <p className="qr-instructions">
                      Abra o WhatsApp no seu celular, toque em ⋮ → Dispositivos conectados → Conectar um dispositivo
                    </p>
                  </div>
                )}

                {connectionStatus === 'Conectado' && instanceInfo && instanceInfo.instance_data && (
                  <div className="connection-details">
                    <h3>✅ WhatsApp Conectado com Sucesso!</h3>
                    <div className="info-grid">
                      <div className="info-item">
                        <label>Nome:</label>
                        <span>{instanceInfo.instance_data.user_info?.name || 'Não informado'}</span>
                      </div>
                      <div className="info-item">
                        <label>Número:</label>
                        <span>{instanceInfo.instance_data.user_info?.id || 'Não informado'}</span>
                      </div>
                      <div className="info-item">
                        <label>Status:</label>
                        <span className="status-connected">Conectado</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><h2>Informações da Instância</h2></div>
              <div className="panel-body">
                <div className="info-grid">
                  <div className="info-item">
                    <label>Nome da Instância:</label>
                    <span>{user.instancia}</span>
                  </div>
                  <div className="info-item">
                    <label>Status da Conexão:</label>
                    <span className={`status-${connectionStatus === 'Conectado' ? 'active' : 
                                    connectionStatus === 'Aguardando conexão' ? 'waiting' : 'inactive'}`}>
                      {connectionStatus}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Data de Verificação:</label>
                    <span>{new Date().toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="info-item">
                    <label>Plano:</label>
                    <span className="plan-badge">Premium</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        );

      case 'groups':
        return (
          <div className="panel">
            <div className="panel-header">
              <h2>Gerenciamento de Grupos</h2>
              <div className="header-actions">
                <button onClick={loadGroups} className="btn btn-secondary btn-sm">
                  <span className="icon">🔄</span> Atualizar
                </button>
              </div>
            </div>
            <div className="panel-body">
              <div className="groups-container">
                <div className="group-create-card">
                  <div className="card-header">
                    <h3><span className="icon">➕</span> Criar Novo Grupo</h3>
                  </div>
                  <div className="card-body">
                    <div className="form-group">
                      <label>Nome do Grupo</label>
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Ex: Grupo de Clientes"
                        className="form-input"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Participantes</label>
                      <div className="input-with-tags">
                        <textarea
                          value={newGroupParticipants.join(', ')}
                          onChange={(e) => {
                            const numbers = e.target.value
                              .split(',')
                              .map(num => num.trim())
                              .filter(num => num !== '');
                            setNewGroupParticipants(numbers);
                          }}
                          placeholder="5511999999999, 5511888888888, 5511777777777"
                          rows="3"
                          className="form-textarea"
                        />
                        <div className="input-tags">
                          {newGroupParticipants.map((number, index) => (
                            <span key={index} className="tag">
                              {number}
                              <button 
                                type="button" 
                                onClick={() => {
                                  const updated = [...newGroupParticipants];
                                  updated.splice(index, 1);
                                  setNewGroupParticipants(updated);
                                }}
                                className="tag-remove"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                      <small className="input-help">
                        Digite os números separados por vírgula. Formato: 5511999999999 (com código do país)
                      </small>
                    </div>
                    
                    <button 
                      onClick={createGroup} 
                      className="btn btn-primary btn-block"
                      disabled={isCreatingGroup || !newGroupName.trim() || newGroupParticipants.length === 0}
                    >
                      {isCreatingGroup ? (
                        <><span className="spinner"></span>Criando Grupo...</>
                      ) : (
                        <><span className="icon">👥</span>Criar Grupo</>
                      )}
                    </button>
                  </div>
                </div>

                <div className="groups-list-section">
                  <div className="section-header">
                    <h3>
                      <span className="icon">📋</span> Todos os Grupos
                      <span className="badge">{groups.length}</span>
                    </h3>
                    <div className="search-box">
                      <input type="text" placeholder="Buscar grupos..." className="search-input" />
                      <span className="search-icon">🔍</span>
                    </div>
                  </div>
                  
                  {groups.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">👥</div>
                      <h4>Ainda nenhum grupo</h4>
                      <p>Conecte-se ao WhatsApp and create your first group</p>
                    </div>
                  ) : (
                    <div className="groups-grid">
                      {groups.map(group => (
                        <div key={group.id} className="group-card">
                          <div className="group-avatar">
                            {group.subject?.charAt(0).toUpperCase() || 'G'}
                          </div>
                          <div className="group-info">
                            <h4 className="group-name">{group.subject || 'Sem nome'}</h4>
                            <p className="group-id">ID: {group.id}</p>
                            <div className="group-meta">
                              <span className="meta-item">
                                <span className="icon">👥</span>
                                {group.size || 0} participantes
                              </span>
                              <span className="meta-item">
                                <span className="icon">👑</span>
                                {group.owner ? group.owner.split('@')[0] : 'Desconhecido'}
                              </span>
                            </div>
                            <div className="group-meta">
                              <span className="meta-item">
                                <span className="icon">📅</span>
                                {group.creation ? new Date(group.creation * 1000).toLocaleDateString('pt-BR') : 'Data desconhecida'}
                              </span>
                            </div>
                            {group.desc && (
                              <div className="group-description">
                                <p>{group.desc}</p>
                              </div>
                            )}
                          </div>
                          <div className="group-actions">
                            <button 
                              className="btn-icon" 
                              title="Enviar mensagem"
                              onClick={() => {
                                setActiveTab('messages');
                                setSelectedGroup(group.id);
                                setSelectedContacts([]);
                              }}
                            >
                              💬
                            </button>
                            <button 
                              className="btn-icon" 
                              title="Ver detalhes"
                              onClick={() => loadGroupDetails(group.id)}
                            >
                              👁️
                            </button>
                            <button 
                              className="btn-icon" 
                              title="Exportar contatos"
                              onClick={() => exportGroupContactsToExcel(group.id)}
                              disabled={isExporting}
                            >
                              {isExporting ? '⏳' : '📊'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'messages':
        return (
          <div className="panel">
            <div className="panel-header">
              <h2>Envio de Mensagens</h2>
            </div>
            <div className="panel-body">
              <div className="form-group">
                <label>Mensagem:</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite sua mensagem aqui..."
                  rows="4"
                />
              </div>
              
              <div className="row">
                <div className="col-6">
                  <h3>Enviar para Grupo</h3>
                  <div className="form-group">
                    <select
                      value={selectedGroup}
                      onChange={(e) => setSelectedGroup(e.target.value)}
                    >
                      <option value="">Selecione um grupo</option>
                      {groups.map(group => (
                        <option key={group.id} value={group.id}>
                          {group.subject}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="col-6">
                  <h3>Enviar para Contatos</h3>
                  <div className="form-group">
                    <select
                      multiple
                      value={selectedContacts}
                      onChange={(e) => setSelectedContacts(
                        Array.from(e.target.selectedOptions, option => option.value)
                      )}
                      style={{height: '150px'}}
                    >
                      {contacts.map(contact => (
                        <option key={contact.id} value={contact.id}>
                          {contact.name || contact.id}
                        </option>
                      ))}
                    </select>
                    <small>Mantenha Ctrl pressionado para selecionar múltiplos contatos</small>
                  </div>
                </div>
              </div>

              {/* Seção de Envio em Massa para Participantes */}
              <div className="form-group">
                <label>Envio em Massa para Participantes</label>
                <select
                  value={selectedGroupForBulk}
                  onChange={(e) => setSelectedGroupForBulk(e.target.value)}
                  className="form-select"
                >
                  <option value="">Selecione um grupo para envio em massa</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.subject} ({group.size} participantes)
                    </option>
                  ))}
                </select>
                
                {selectedGroupForBulk && (
                  <button 
                    onClick={() => sendMessageToAllParticipants(selectedGroupForBulk, message)}
                    className="btn btn-warning btn-block"
                    disabled={isSendingToParticipants || !message.trim()}
                    style={{ marginTop: '10px' }}
                  >
                    {isSendingToParticipants ? (
                      <><span className="spinner"></span> Enviando para participantes...</>
                    ) : (
                      '🚀 Enviar para TODOS os participantes deste grupo'
                    )}
                  </button>
                )}
                
                <div className="security-notice">
                  <div className="security-icon">🛡️</div>
                  <div className="security-text">
                    <strong>Proteção contra bloqueio ativada:</strong> 
                    <small>Mensagens são enviadas com delays aleatórios para evitar bloqueio do WhatsApp.</small>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={sendMessage} 
                className="btn btn-primary"
                disabled={isSending || (!selectedGroup && selectedContacts.length === 0)}
              >
                {isSending ? 'Enviando...' : 'Enviar Mensagem'}
              </button>
              
              {sendingStatus && <p className="status-message">{sendingStatus}</p>}
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="panel">
            <div className="panel-header">
              <h2>Configurações</h2>
            </div>
            <div className="panel-body">
              <div className="form-group">
                <label>Nome:</label>
                <input type="text" value={user.nome} disabled />
              </div>
              
              <div className="form-group">
                <label>Email:</label>
                <input type="email" value={user.email} disabled />
              </div>
              
              <div className="form-group">
                <label>Instância:</label>
                <input type="text" value={user.instancia} disabled />
              </div>
              
              <div className="form-group">
                <label>Webhook (opcional):</label>
                <input 
                  type="text" 
                  defaultValue={user.webhook || ''} 
                  placeholder="URL do webhook"
                />
              </div>
              
              <button className="btn btn-primary">Salvar Configurações</button>
            </div>
          </div>
        );

      default:
        return <div>Conteúdo não encontrado</div>;
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>FluxoConnect</h2>
        </div>
        <div className="sidebar-user">
          <div className="user-avatar">
            {user.nome.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <h4>{user.nome}</h4>
            <p>{user.email}</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          <ul>
            <li className={activeTab === 'dashboard' ? 'active' : ''}>
              <button onClick={() => setActiveTab('dashboard')}>
                <span className="icon">📊</span> Dashboard
              </button>
            </li>
            <li className={activeTab === 'groups' ? 'active' : ''}>
              <button onClick={() => setActiveTab('groups')}>
                <span className="icon">👥</span> Grupos
              </button>
            </li>
            <li className={activeTab === 'messages' ? 'active' : ''}>
              <button onClick={() => setActiveTab('messages')}>
                <span className="icon">✉️</span> Mensagens
              </button>
            </li>
            <li className={activeTab === 'settings' ? 'active' : ''}>
              <button onClick={() => setActiveTab('settings')}>
                <span className="icon">⚙️</span> Configurações
              </button>
            </li>
          </ul>
        </nav>
        <div className="sidebar-footer">
          <button onClick={onLogout} className="btn-logout">
            <span className="icon">🚪</span> Sair
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <header className="content-header">
          <h1>
            {activeTab === 'dashboard' && 'Dashboard'}
            {activeTab === 'groups' && 'Gerenciamento de Grupos'}
            {activeTab === 'messages' && 'Envio de Mensagens'}
            {activeTab === 'settings' && 'Configurações'}
          </h1>
          <div className="header-actions">
            <div className="connection-status">
              <span className={`status-indicator ${
                connectionStatus === 'Conectado' ? 'connected' : 
                connectionStatus === 'Aguardando conexão' ? 'waiting' : 
                'disconnected'
              }`}></span>
              {connectionStatus}
            </div>
            <div className="notification-bell">🔔</div>
          </div>
        </header>

        <div className="content">
          {renderActiveTabContent()}
        </div>
      </div>

      {/* Modal de Detalhes do Grupo */}
      <GroupDetailsModal />
    </div>
  );
};

export default Dashboard;