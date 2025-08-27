// src/components/Dashboard.js - Versão Final Sem Grupos Próprios + API Centralizada
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './Dashboard.css';
import api from '../../services/api';

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
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);

  // Estados para mensagens
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendingStatus, setSendingStatus] = useState('');
  const [selectedGroupForBulk, setSelectedGroupForBulk] = useState('');
  const [isSendingToParticipants, setIsSendingToParticipants] = useState(false);

  // Estados para UI mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para configurações anti-bloqueio (removido showOnlyOwnedGroups)
  const [antiBanSettings, setAntiBanSettings] = useState({
    enableSmartDelays: true,
    enableUserAgentRotation: true,
    enableBatchProcessing: true,
    enableProgressiveDelay: true,
    enableQualityMonitoring: true,
    excludeOwnNumber: true,
    minDelay: 3000,
    maxDelay: 8000,
    batchSize: 3,
    batchDelay: 15000,
    maxDailyMessages: 500,
    maxHourlyMessages: 50
  });

  // Estados para monitoramento (corrigido para usar API específica do cliente)
  const [messageStats, setMessageStats] = useState({
    sentThisHour: 0,
    successRate: 100,
    messagesFromAPI: 0, // Mensagens da API Steinhq específicas do cliente
    lastResetDate: new Date().toDateString(),
    lastResetHour: new Date().getHours()
  });

  // Estado para armazenar o número logado
  const [loggedNumber, setLoggedNumber] = useState(null);

  // Estados para API de disparos
  const [isUpdatingDispatch, setIsUpdatingDispatch] = useState(false);

  // Constantes para controle de delay inteligente melhorado
  const MESSAGE_DELAY = {
    MIN: antiBanSettings.minDelay,
    MAX: antiBanSettings.maxDelay,
    BATCH_SIZE: antiBanSettings.batchSize,
    BATCH_DELAY: antiBanSettings.batchDelay,
    PROGRESSIVE_MULTIPLIER: 1.2,
    ERROR_PENALTY_MULTIPLIER: 2.0,
    SUCCESS_BONUS_MULTIPLIER: 0.8
  };

  const API_KEY = user.apiKey || 'lcV71zmct4xwueG7nd7y0uw9mcAOYBTKN3EbAu/1OIXU2QKYvmILUAFlhF2WoclioIvoL1fORjBaFrX0TWqY3g==';

  // Efeitos
  useEffect(() => {
    checkInstanceStatus();
    initializeMessageStats();
    loadDispatchCount(); // Carregar contagem de disparos específica do cliente
    
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

  // Função para verificar se um número é o próprio número logado
  const isOwnNumber = (targetNumber) => {
    if (!antiBanSettings.excludeOwnNumber || !loggedNumber) return false;
    
    const normalizedTarget = api.utils.normalizePhoneNumber(api.utils.extractPhoneNumber(targetNumber));
    const normalizedLogged = api.utils.normalizePhoneNumber(api.utils.extractPhoneNumber(loggedNumber));
    
    const matches = [
      normalizedTarget === normalizedLogged,
      normalizedTarget === api.utils.normalizePhoneNumber(phoneNumber),
      api.utils.extractPhoneNumber(targetNumber) === api.utils.extractPhoneNumber(loggedNumber),
      targetNumber === loggedNumber,
      targetNumber.includes(normalizedLogged),
      normalizedLogged.includes(normalizedTarget)
    ];
    
    return matches.some(match => match);
  };

  // Função para filtrar próprio número de uma lista
  const filterOwnNumber = (numbersList) => {
    if (!antiBanSettings.excludeOwnNumber) return numbersList;
    
    const filtered = numbersList.filter(number => !isOwnNumber(number));
    const excludedCount = numbersList.length - filtered.length;
    
    if (excludedCount > 0) {
      console.log(`🚫 Excluído próprio número ${excludedCount} vez(es) da lista de envio`);
    }
    
    return filtered;
  };

  // Função corrigida para carregar contagem de disparos da API específica do cliente
  const loadDispatchCount = async () => {
    try {
      console.log(`📊 Carregando contagem de disparos para cliente: ${user.instancia}`);
      const count = await api.dispatch.getCount(user.instancia);
      console.log(`📊 Contagem obtida: ${count}`);
      
      setMessageStats(prev => ({
        ...prev,
        messagesFromAPI: count
      }));
    } catch (error) {
      console.error('❌ Erro ao carregar contagem de disparos:', error);
      setMessageStats(prev => ({
        ...prev,
        messagesFromAPI: 0
      }));
    }
  };

  // Função corrigida para atualizar contagem de disparos na API específica do cliente
  const updateDispatchCount = async (incrementBy = 1) => {
    if (isUpdatingDispatch) return;
    
    setIsUpdatingDispatch(true);
    try {
      console.log(`📊 Atualizando contagem de disparos para cliente ${user.instancia}...`);
      const newCount = await api.dispatch.increment(user.instancia, incrementBy);
      
      setMessageStats(prev => ({
        ...prev,
        messagesFromAPI: newCount
      }));
      
      console.log(`✅ Contagem de disparos atualizada: ${newCount}`);
    } catch (error) {
      console.error('❌ Erro ao atualizar contagem de disparos:', error);
    } finally {
      setIsUpdatingDispatch(false);
    }
  };

  // Inicializar estatísticas de mensagens (ajustado)
  const initializeMessageStats = () => {
    const today = new Date().toDateString();
    const currentHour = new Date().getHours();
    
    if (messageStats.lastResetDate !== today) {
      setMessageStats(prev => ({
        ...prev,
        lastResetDate: today
      }));
    }
    
    if (messageStats.lastResetHour !== currentHour) {
      setMessageStats(prev => ({
        ...prev,
        sentThisHour: 0,
        lastResetHour: currentHour
      }));
    }
  };

  // Funções utilitárias melhoradas
  const getSmartDelay = (messageIndex, errorCount = 0, successCount = 0) => {
    let baseDelay = Math.floor(Math.random() * (MESSAGE_DELAY.MAX - MESSAGE_DELAY.MIN + 1)) + MESSAGE_DELAY.MIN;
    
    if (antiBanSettings.enableProgressiveDelay) {
      const progressiveMultiplier = Math.pow(MESSAGE_DELAY.PROGRESSIVE_MULTIPLIER, Math.floor(messageIndex / 10));
      baseDelay *= progressiveMultiplier;
    }
    
    if (errorCount > 0) {
      baseDelay *= Math.pow(MESSAGE_DELAY.ERROR_PENALTY_MULTIPLIER, errorCount);
    }
    
    if (successCount > 5) {
      baseDelay *= MESSAGE_DELAY.SUCCESS_BONUS_MULTIPLIER;
    }
    
    const variation = (Math.random() - 0.5) * 0.3;
    baseDelay *= (1 + variation);
    
    return Math.min(baseDelay, 30000);
  };

  // Função para filtrar grupos (removido filtro de grupos próprios)
  const filteredGroups = groups.filter(group => {
    return group.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           group.id?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Verificar limites de envio (ajustado)
  const checkSendingLimits = () => {
    if (messageStats.sentThisHour >= antiBanSettings.maxHourlyMessages) {
      throw new Error(`Limite de ${antiBanSettings.maxHourlyMessages} mensagens por hora atingido. Aguarde.`);
    }
  };

  // Atualizar estatísticas de mensagens (ajustado)
  const updateMessageStats = (success = true) => {
    setMessageStats(prev => {
      const newStats = {
        ...prev,
        sentThisHour: prev.sentThisHour + 1
      };
      
      const totalSent = prev.sentThisHour + 1;
      const successfulSent = success ? totalSent : totalSent - 1;
      newStats.successRate = Math.round((successfulSent / totalSent) * 100);
      
      return newStats;
    });
  };

  // Função para detectar horários de pico
  const isOptimalSendingTime = () => {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    if (hour < 8 || hour > 22) return false;
    if (day === 0 || day === 6) return false;
    
    return true;
  };

  // Função para sair do grupo
  const leaveGroup = async (groupJid, groupName) => {
    if (!window.confirm(`Tem certeza que deseja sair do grupo "${groupName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setIsLeavingGroup(true);
    try {
      await api.groups.leave(user.instancia, groupJid, API_KEY, antiBanSettings.enableUserAgentRotation);
      alert(`✅ Você saiu do grupo "${groupName}" com sucesso!`);
      await loadGroups();
      setSelectedGroupForDetails(null);
    } catch (error) {
      console.error('Erro ao sair do grupo:', error);
      alert('❌ Erro ao sair do grupo: ' + error.message);
    } finally {
      setIsLeavingGroup(false);
    }
  };

  // Função para exportar contatos para Excel
  const exportGroupContactsToExcel = async (groupJid) => {
    if (!groupJid) return;
    
    setIsExporting(true);
    try {
      const groupDetails = await api.groups.getInfo(user.instancia, groupJid, API_KEY, antiBanSettings.enableUserAgentRotation);
      let participants = groupDetails.participants || [];

      // Filtrar próprio número se a opção estiver ativada
      if (antiBanSettings.excludeOwnNumber) {
        const originalCount = participants.length;
        participants = participants.filter(participant => !isOwnNumber(participant.id));
        const excludedCount = originalCount - participants.length;
        
        if (excludedCount > 0) {
          console.log(`🚫 Excluído próprio número da exportação (${excludedCount} ocorrência(s))`);
        }
      }

      if (participants.length === 0) {
        alert('Nenhum participante encontrado no grupo (após filtros)');
        return;
      }

      const exportData = participants.map(participant => ({
        'Número': participant.id.split('@')[0],
        'ID Completo': participant.id,
        'Cargo': participant.admin === 'superadmin' ? 'Dono' : 
                 participant.admin === 'admin' ? 'Admin' : 'Membro',
        'Nome do Grupo': groupDetails.subject || 'Sem nome',
        'ID do Grupo': groupDetails.id,
        'Data Exportação': new Date().toLocaleDateString('pt-BR'),
        'Próprio Número Excluído': antiBanSettings.excludeOwnNumber ? 'Sim' : 'Não'
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Contatos do Grupo');
      
      const fileName = `contatos-${groupDetails.subject || 'grupo'}-${new Date().getTime()}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      alert(`✅ ${participants.length} contatos exportados com sucesso!${antiBanSettings.excludeOwnNumber ? ' (Próprio número excluído)' : ''}`);
    } catch (error) {
      console.error('Erro ao exportar contatos:', error);
      alert('❌ Erro ao exportar contatos: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Funções da API usando o serviço centralizado
  const checkConnectionState = async () => {
    try {
      const data = await api.instance.checkConnectionState(user.instancia, API_KEY, antiBanSettings.enableUserAgentRotation);
      const connectionState = data.instance?.state;
      
      if (connectionState === 'open') {
        setConnectionStatus('Conectado');
        setInstanceCreated(true);
        setQrCode(null);
        
        // Capturar o número logado quando conectado
        if (data.instance?.user_info?.id) {
          setLoggedNumber(data.instance.user_info.id);
          console.log('📱 Número logado capturado:', data.instance.user_info.id);
        }
      } else if (connectionState === 'close') {
        setConnectionStatus('Desconectado');
        setLoggedNumber(null);
      }
      return connectionState;
    } catch (error) {
      setConnectionStatus('Erro ao verificar conexão');
      return null;
    }
  };

  const checkInstanceStatus = async () => {
    try {
      const data = await api.instance.connect(user.instancia, API_KEY, antiBanSettings.enableUserAgentRotation);
      setInstanceInfo(data);
      setInstanceExists(true);
      
      // Capturar número logado se disponível
      if (data.instance_data?.user_info?.id) {
        setLoggedNumber(data.instance_data.user_info.id);
        console.log('📱 Número logado capturado:', data.instance_data.user_info.id);
      }
      
      await checkConnectionState();
    } catch (error) {
      if (error.response?.status === 404) {
        setConnectionStatus('Desconectado');
        setInstanceExists(false);
        setInstanceInfo(null);
        setLoggedNumber(null);
      } else {
        await checkConnectionState();
      }
    }
  };

  const getQRCode = async () => {
    try {
      const qrData = await api.instance.connect(user.instancia, API_KEY, antiBanSettings.enableUserAgentRotation);
      
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
    } catch (error) {
      await checkInstanceStatus();
    }
  };

  const createInstanceAndGenerateQR = async () => {
    setIsConnecting(true);
    try {
      const formattedNumber = api.utils.validateAndFormatPhoneNumber(phoneNumber);
      const requestData = {
        instanceName: user.instancia,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true
      };
      
      if (formattedNumber) requestData.number = formattedNumber;
      if (user.webhook) requestData.webhook = user.webhook;
      
      await api.instance.create(requestData, API_KEY, antiBanSettings.enableUserAgentRotation);
      setInstanceCreated(true);
      setInstanceExists(true);
      await getQRCode();
      startStatusChecking();
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

  // Função corrigida para desconectar (logout) usando a API correta
  const logoutInstance = async () => {
    if (!window.confirm('Tem certeza que deseja desconectar o WhatsApp? Você precisará escanear o QR Code novamente.')) return;
    
    setIsDeleting(true);
    try {
      await api.instance.logout(user.instancia, API_KEY, antiBanSettings.enableUserAgentRotation);
      
      // Resetar estados após logout
      setConnectionStatus('Desconectado');
      setQrCode(null);
      setInstanceCreated(false);
      setLoggedNumber(null);
      
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        setStatusCheckInterval(null);
      }
      
      alert('✅ WhatsApp desconectado com sucesso!');
    } catch (error) {
      console.error('Erro ao desconectar instância:', error);
      alert('❌ Erro ao desconectar: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Funções para grupos
  const loadGroups = async () => {
    try {
      const data = await api.groups.fetchAll(user.instancia, API_KEY, true, antiBanSettings.enableUserAgentRotation);
      console.log('📋 Grupos carregados:', data);
      setGroups(data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar grupos:', error);
      setGroups([]);
    }
  };

  const loadGroupDetails = async (groupJid) => {
    setIsLoadingDetails(true);
    setSelectedGroupForDetails(groupJid);
    try {
      const data = await api.groups.getInfo(user.instancia, groupJid, API_KEY, antiBanSettings.enableUserAgentRotation);
      setGroupDetails(data);
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

    // Filtrar próprio número dos participantes
    let filteredParticipants = newGroupParticipants;
    if (antiBanSettings.excludeOwnNumber) {
      filteredParticipants = filterOwnNumber(newGroupParticipants);
      if (filteredParticipants.length !== newGroupParticipants.length) {
        const excludedCount = newGroupParticipants.length - filteredParticipants.length;
        alert(`⚠️ Seu próprio número foi removido da lista de participantes (${excludedCount} ocorrência(s))`);
      }
    }

    if (filteredParticipants.length === 0) {
      alert('Nenhum participante válido após filtros. Adicione outros números.');
      return;
    }

    const invalidNumbers = filteredParticipants.filter(number => !/^(\d+|\d+@.+\..+)$/.test(number));
    if (invalidNumbers.length > 0) {
      alert(`Os seguintes números têm formato inválido: ${invalidNumbers.join(', ')}`);
      return;
    }

    setIsCreatingGroup(true);
    try {
      await api.groups.create(user.instancia, {
        subject: newGroupName,
        participants: filteredParticipants
      }, API_KEY, antiBanSettings.enableUserAgentRotation);

      setNewGroupName('');
      setNewGroupParticipants([]);
      alert(`✅ Grupo criado com sucesso com ${filteredParticipants.length} participantes!`);
      await loadGroups();
    } catch (error) {
      alert('Erro ao criar grupo: ' + error.message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Funções para mensagens com melhorias anti-bloqueio
  const loadContacts = async () => {
    try {
      let contactsList = await api.contacts.fetchAll(user.instancia, API_KEY, antiBanSettings.enableUserAgentRotation);
      
      // Filtrar próprio número da lista de contatos
      if (antiBanSettings.excludeOwnNumber) {
        const originalCount = contactsList.length;
        contactsList = contactsList.filter(contact => !isOwnNumber(contact.id));
        const excludedCount = originalCount - contactsList.length;
        
        if (excludedCount > 0) {
          console.log(`🚫 Próprio número excluído da lista de contatos (${excludedCount} ocorrência(s))`);
        }
      }
      
      setContacts(contactsList);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
    }
  };

  // Função melhorada para enviar mensagem com proteção avançada contra bloqueio
  const sendMessageWithAdvancedProtection = async (number, messageText, options = {}) => {
    const {
      messageIndex = 0,
      retryCount = 0,
      maxRetries = 3,
      errorCount = 0,
      successCount = 0
    } = options;

    try {
      // Verificar se é o próprio número
      if (isOwnNumber(number)) {
        console.log(`🚫 Pulando envio para próprio número: ${number}`);
        return { success: true, skipped: true, reason: 'Próprio número excluído' };
      }

      checkSendingLimits();
      
      if (!isOptimalSendingTime() && antiBanSettings.enableQualityMonitoring) {
        console.warn('Enviando fora do horário ótimo');
      }

      const delay = antiBanSettings.enableSmartDelays ? 
        getSmartDelay(messageIndex, errorCount, successCount) : 
        Math.floor(Math.random() * (MESSAGE_DELAY.MAX - MESSAGE_DELAY.MIN + 1)) + MESSAGE_DELAY.MIN;

      const result = await api.messages.sendText(user.instancia, {
        number,
        text: messageText,
        delay: Math.floor(delay),
        presence: "composing"
      }, API_KEY, antiBanSettings.enableUserAgentRotation);

      updateMessageStats(true);
      // Atualizar contagem de disparos na API
      await updateDispatchCount(1);
      return { success: true, delay };
    } catch (error) {
      if ((error.response?.status === 429 || error.response?.status >= 500) && retryCount < maxRetries) {
        const retryDelay = Math.pow(2, retryCount) * 3000 + Math.random() * 2000;
        console.log(`Tentativa ${retryCount + 1}/${maxRetries} em ${retryDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        return sendMessageWithAdvancedProtection(number, messageText, { 
          ...options, 
          retryCount: retryCount + 1,
          errorCount: errorCount + 1
        });
      }
      
      updateMessageStats(false);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Erro desconhecido',
        status: error.response?.status
      };
    }
  };

  // Versão melhorada da função sendMessage
  const sendMessage = async () => {
    if (!message.trim()) {
      alert('Por favor, digite uma mensagem');
      return;
    }

    try {
      checkSendingLimits();
    } catch (error) {
      alert(error.message);
      return;
    }

    setIsSending(true);
    setSendingStatus('Iniciando envio com proteção anti-bloqueio...');

    try {
      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;
      let consecutiveErrors = 0;
      let consecutiveSuccesses = 0;
      const errors = [];
      const targets = [];

      // Preparar lista de alvos
      if (selectedGroup) {
        targets.push({ type: 'group', id: selectedGroup, name: 'Grupo selecionado' });
      }
      
      // Filtrar próprio número dos contatos selecionados
      let filteredContacts = selectedContacts;
      if (antiBanSettings.excludeOwnNumber) {
        filteredContacts = filterOwnNumber(selectedContacts);
        const excludedCount = selectedContacts.length - filteredContacts.length;
        if (excludedCount > 0) {
          skippedCount += excludedCount;
          setSendingStatus(`🚫 Próprio número excluído da lista (${excludedCount} ocorrência(s))`);
        }
      }
      
      filteredContacts.forEach(contact => {
        targets.push({ type: 'contact', id: contact, name: contact });
      });

      if (targets.length === 0) {
        alert('Selecione pelo menos um grupo ou contato (após filtros)');
        return;
      }

      setSendingStatus(`Enviando para ${targets.length} destinatários com proteção anti-bloqueio...`);

      // Processar em lotes se habilitado
      if (antiBanSettings.enableBatchProcessing) {
        for (let batchIndex = 0; batchIndex < targets.length; batchIndex += MESSAGE_DELAY.BATCH_SIZE) {
          const batch = targets.slice(batchIndex, batchIndex + MESSAGE_DELAY.BATCH_SIZE);
          const batchNumber = Math.floor(batchIndex / MESSAGE_DELAY.BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(targets.length / MESSAGE_DELAY.BATCH_SIZE);
          
          setSendingStatus(`Processando lote ${batchNumber}/${totalBatches} (${batch.length} mensagens)...`);

          for (let i = 0; i < batch.length; i++) {
            const target = batch[i];
            const messageIndex = batchIndex + i;
            
            setSendingStatus(`Lote ${batchNumber}/${totalBatches} - Enviando ${i + 1}/${batch.length} (${target.name})...`);

            const result = await sendMessageWithAdvancedProtection(target.id, message, {
              messageIndex,
              errorCount: consecutiveErrors,
              successCount: consecutiveSuccesses
            });

            if (result.success) {
              if (result.skipped) {
                skippedCount++;
                setSendingStatus(`🚫 Pulado: ${target.name} (${result.reason})`);
              } else {
                successCount++;
                consecutiveSuccesses++;
                consecutiveErrors = 0;
                setSendingStatus(`✅ Enviado para ${target.name} (delay: ${Math.round(result.delay)}ms)`);
              }
            } else {
              errors.push(`${target.name}: ${result.error}`);
              errorCount++;
              consecutiveErrors++;
              consecutiveSuccesses = 0;
              setSendingStatus(`❌ Erro ao enviar para ${target.name}: ${result.error}`);
              
              if (consecutiveErrors >= 5) {
                throw new Error('Muitos erros consecutivos. Parando para evitar bloqueio.');
              }
            }

            if (i < batch.length - 1) {
              const delay = getSmartDelay(messageIndex, consecutiveErrors, consecutiveSuccesses);
              setSendingStatus(`Aguardando ${Math.round(delay)}ms antes da próxima mensagem...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }

          if (batchIndex + MESSAGE_DELAY.BATCH_SIZE < targets.length) {
            setSendingStatus(`Aguardando ${MESSAGE_DELAY.BATCH_DELAY/1000}s antes do próximo lote...`);
            await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY.BATCH_DELAY));
          }
        }
      } else {
        // Envio sequencial sem lotes
        for (let i = 0; i < targets.length; i++) {
          const target = targets[i];
          setSendingStatus(`Enviando ${i + 1}/${targets.length} para ${target.name}...`);

          const result = await sendMessageWithAdvancedProtection(target.id, message, {
            messageIndex: i,
            errorCount: consecutiveErrors,
            successCount: consecutiveSuccesses
          });

          if (result.success) {
            if (result.skipped) {
              skippedCount++;
            } else {
              successCount++;
              consecutiveSuccesses++;
              consecutiveErrors = 0;
            }
          } else {
            errors.push(`${target.name}: ${result.error}`);
            errorCount++;
            consecutiveErrors++;
            consecutiveSuccesses = 0;
            
            if (consecutiveErrors >= 5) {
              throw new Error('Muitos erros consecutivos. Parando para evitar bloqueio.');
            }
          }

          if (i < targets.length - 1) {
            const delay = getSmartDelay(i, consecutiveErrors, consecutiveSuccesses);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // Resultado final
      const totalProcessed = successCount + errorCount + skippedCount;
      const successRate = totalProcessed > 0 ? Math.round((successCount / totalProcessed) * 100) : 0;
      
      setSendingStatus(
        `🎉 Concluído! ${successCount} enviadas, ${skippedCount} puladas, ${errorCount} erros de ${targets.length} total. ` +
        `Taxa de sucesso: ${successRate}%. Taxa geral: ${messageStats.successRate}%. ` +
        `Mensagens hoje: ${messageStats.messagesFromAPI + successCount}`
      );
      
      if (errors.length > 0) {
        setSendingStatus(prev => prev + `. Erros: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
      }
      
      if (errorCount === 0) {
        setMessage('');
        setSelectedContacts([]);
        setSelectedGroup('');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagens:', error);
      setSendingStatus('❌ Erro: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const sendMessageToAllParticipants = async (groupJid, messageText) => {
    setIsSendingToParticipants(true);
    setSendingStatus('Buscando participantes do grupo...');

    try {
      checkSendingLimits();
      
      const groupDetails = await api.groups.getInfo(user.instancia, groupJid, API_KEY, antiBanSettings.enableUserAgentRotation);
      let participants = groupDetails.participants || [];

      // Filtrar próprio número dos participantes
      const originalParticipantsCount = participants.length;
      if (antiBanSettings.excludeOwnNumber) {
        participants = participants.filter(participant => !isOwnNumber(participant.id));
        const excludedCount = originalParticipantsCount - participants.length;
        
        if (excludedCount > 0) {
          setSendingStatus(`🚫 Próprio número excluído da lista (${excludedCount} ocorrência(s))`);
        }
      }

      if (participants.length === 0) {
        setSendingStatus('Nenhum participante encontrado no grupo (após filtros)');
        return;
      }

      setSendingStatus(`Preparando envio para ${participants.length} participantes com proteção anti-bloqueio...`);

      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;
      let consecutiveErrors = 0;
      let consecutiveSuccesses = 0;
      const errors = [];

      for (let batchIndex = 0; batchIndex < participants.length; batchIndex += MESSAGE_DELAY.BATCH_SIZE) {
        const batch = participants.slice(batchIndex, batchIndex + MESSAGE_DELAY.BATCH_SIZE);
        const batchNumber = Math.floor(batchIndex / MESSAGE_DELAY.BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(participants.length / MESSAGE_DELAY.BATCH_SIZE);
        
        setSendingStatus(`Processando lote ${batchNumber}/${totalBatches} (${batch.length} participantes)...`);

        for (let i = 0; i < batch.length; i++) {
          const participant = batch[i];
          const participantNumber = batchIndex + i + 1;
          
          setSendingStatus(`Lote ${batchNumber}/${totalBatches} - Enviando para participante ${participantNumber}/${participants.length}...`);

          try {
            const result = await sendMessageWithAdvancedProtection(participant.id, messageText, {
              messageIndex: participantNumber - 1,
              errorCount: consecutiveErrors,
              successCount: consecutiveSuccesses
            });

            if (result.success) {
              if (result.skipped) {
                skippedCount++;
              } else {
                successCount++;
                consecutiveSuccesses++;
                consecutiveErrors = 0;
              }
            } else {
              errors.push(`Participante ${participant.id}: ${result.error || 'Erro desconhecido'}`);
              errorCount++;
              consecutiveErrors++;
              consecutiveSuccesses = 0;
              
              if (consecutiveErrors >= 10) {
                throw new Error('Muitos erros consecutivos. Parando envio para evitar bloqueio.');
              }
            }
          } catch (error) {
            errors.push(`Participante ${participant.id}: ${error.message}`);
            errorCount++;
            consecutiveErrors++;
            consecutiveSuccesses = 0;
            
            if (consecutiveErrors >= 10) {
              throw new Error('Muitos erros consecutivos. Parando envio para evitar bloqueio.');
            }
          }

          if (i < batch.length - 1) {
            const delay = getSmartDelay(participantNumber - 1, consecutiveErrors, consecutiveSuccesses);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        if (batchIndex + MESSAGE_DELAY.BATCH_SIZE < participants.length) {
          setSendingStatus(`Aguardando ${MESSAGE_DELAY.BATCH_DELAY/1000} segundos antes do próximo lote...`);
          await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY.BATCH_DELAY));
        }
      }

      // Resultado final
      const totalProcessed = successCount + errorCount + skippedCount;
      const successRate = totalProcessed > 0 ? Math.round((successCount / totalProcessed) * 100) : 0;
      
      if (errorCount === 0 && skippedCount === 0) {
        setSendingStatus(`✅ Mensagens enviadas para todos os ${successCount} participantes com sucesso! Taxa de sucesso: ${successRate}%. Mensagens hoje: ${messageStats.messagesFromAPI + successCount}`);
      } else {
        setSendingStatus(
          `📊 Resultado: ${successCount} enviadas, ${skippedCount} puladas, ${errorCount} erros de ${participants.length} participantes. ` +
          `Taxa de sucesso: ${successRate}%. Taxa geral: ${messageStats.successRate}%. Mensagens hoje: ${messageStats.messagesFromAPI + successCount}. ` +
          `${errors.length > 0 ? `Primeiros erros: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}` : ''}`
        );
      }

    } catch (error) {
      console.error('Erro ao enviar para participantes:', error);
      setSendingStatus('❌ Erro: ' + error.message);
    } finally {
      setIsSendingToParticipants(false);
    }
  };

  // Render functions (mantidas iguais)
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
        <button onClick={logoutInstance} className="btn btn-danger" disabled={isDeleting}>
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

  // Modal de configurações anti-bloqueio atualizado (removido showOnlyOwnedGroups)
  const AntiBanSettingsModal = () => {
    const [showSettings, setShowSettings] = useState(false);
    const [tempSettings, setTempSettings] = useState(antiBanSettings);

    const saveSettings = () => {
      setAntiBanSettings(tempSettings);
      setShowSettings(false);
      alert('Configurações anti-bloqueio salvas com sucesso!');
    };

    if (!showSettings) {
      return (
        <button 
          className="btn btn-secondary btn-sm"
          onClick={() => setShowSettings(true)}
          title="Configurações Anti-Bloqueio"
        >
          🛡️ Configurações Anti-Bloqueio
        </button>
      );
    }

    return (
      <div className="modal-overlay" onClick={() => setShowSettings(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>🛡️ Configurações Anti-Bloqueio</h3>
            <button onClick={() => setShowSettings(false)} className="modal-close">×</button>
          </div>
          
          <div className="modal-body">
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={tempSettings.enableSmartDelays}
                  onChange={(e) => setTempSettings({...tempSettings, enableSmartDelays: e.target.checked})}
                />
                Delays Inteligentes
              </label>
              <small className="input-help">Ajusta automaticamente os delays baseado no desempenho</small>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={tempSettings.enableUserAgentRotation}
                  onChange={(e) => setTempSettings({...tempSettings, enableUserAgentRotation: e.target.checked})}
                />
                Rotação de User Agent
              </label>
              <small className="input-help">Simula diferentes dispositivos WhatsApp</small>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={tempSettings.enableBatchProcessing}
                  onChange={(e) => setTempSettings({...tempSettings, enableBatchProcessing: e.target.checked})}
                />
                Processamento em Lotes
              </label>
              <small className="input-help">Divide envios em lotes menores com pausas</small>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={tempSettings.enableProgressiveDelay}
                  onChange={(e) => setTempSettings({...tempSettings, enableProgressiveDelay: e.target.checked})}
                />
                Delay Progressivo
              </label>
              <small className="input-help">Aumenta delays progressivamente durante o envio</small>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={tempSettings.enableQualityMonitoring}
                  onChange={(e) => setTempSettings({...tempSettings, enableQualityMonitoring: e.target.checked})}
                />
                Monitoramento de Qualidade
              </label>
              <small className="input-help">Monitora horários ótimos e taxa de sucesso</small>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={tempSettings.excludeOwnNumber}
                  onChange={(e) => setTempSettings({...tempSettings, excludeOwnNumber: e.target.checked})}
                />
                🚫 Excluir Próprio Número
              </label>
              <small className="input-help">Evita enviar mensagens para o número logado na plataforma</small>
            </div>

            <div className="form-group">
              <label>Delay Mínimo (ms):</label>
              <input
                type="number"
                className="form-input"
                value={tempSettings.minDelay}
                onChange={(e) => setTempSettings({...tempSettings, minDelay: parseInt(e.target.value)})}
                min="1000"
                max="10000"
              />
            </div>

            <div className="form-group">
              <label>Delay Máximo (ms):</label>
              <input
                type="number"
                className="form-input"
                value={tempSettings.maxDelay}
                onChange={(e) => setTempSettings({...tempSettings, maxDelay: parseInt(e.target.value)})}
                min="2000"
                max="30000"
              />
            </div>

            <div className="form-group">
              <label>Tamanho do Lote:</label>
              <input
                type="number"
                className="form-input"
                value={tempSettings.batchSize}
                onChange={(e) => setTempSettings({...tempSettings, batchSize: parseInt(e.target.value)})}
                min="1"
                max="10"
              />
            </div>

            <div className="form-group">
              <label>Delay Entre Lotes (ms):</label>
              <input
                type="number"
                className="form-input"
                value={tempSettings.batchDelay}
                onChange={(e) => setTempSettings({...tempSettings, batchDelay: parseInt(e.target.value)})}
                min="5000"
                max="60000"
              />
            </div>

            <div className="form-group">
              <label>Limite por Hora:</label>
              <input
                type="number"
                className="form-input"
                value={tempSettings.maxHourlyMessages}
                onChange={(e) => setTempSettings({...tempSettings, maxHourlyMessages: parseInt(e.target.value)})}
                min="5"
                max="100"
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={saveSettings}>
                Salvar Configurações
              </button>
              <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Modal de detalhes do grupo melhorado (removido verificações de grupos próprios)
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
                    {loggedNumber && (
                      <div className="info-item">
                        <label>Número Logado:</label>
                        <span className="logged-number">{api.utils.extractPhoneNumber(loggedNumber)}</span>
                      </div>
                    )}
                    {antiBanSettings.excludeOwnNumber && (
                      <div className="info-item">
                        <label>Exclusão Próprio Número:</label>
                        <span className="status-active">✅ Ativada</span>
                      </div>
                    )}
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
                      {groupDetails.participants.map((participant, index) => {
                        const isOwn = isOwnNumber(participant.id);
                        return (
                          <div key={index} className={`participant-item ${isOwn ? 'own-number' : ''}`}>
                            <span className="participant-id">
                              {participant.id}
                              {isOwn && <span className="own-badge">🚫 Você</span>}
                            </span>
                            <span className={`participant-role ${participant.admin || 'member'}`}>
                              {participant.admin === 'superadmin' ? 'Dono' : 
                               participant.admin === 'admin' ? 'Admin' : 'Membro'}
                            </span>
                          </div>
                        );
                      })}
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
                  <button 
                    className="btn btn-danger"
                    onClick={() => leaveGroup(groupDetails.id, groupDetails.subject)}
                    disabled={isLeavingGroup}
                  >
                    {isLeavingGroup ? (
                      <><span className="spinner"></span> Saindo...</>
                    ) : (
                      '🚪 Sair do Grupo'
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
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon primary">📱</div>
                <div className="stat-content">
                  <h3>Status da Instância</h3>
                  <p className={instanceExists ? 'status-active' : 'status-inactive'}>
                    {instanceExists ? 'Ativa' : 'Inativa'}
                  </p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon secondary">🔗</div>
                <div className="stat-content">
                  <h3>Conexão WhatsApp</h3>
                  <p className={`status-${connectionStatus === 'Conectado' ? 'active' : 
                                connectionStatus === 'Aguardando conexão' ? 'waiting' : 'inactive'}`}>
                    {connectionStatus}
                  </p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon tertiary">👥</div>
                <div className="stat-content">
                  <h3>Total de Grupos</h3>
                  <p className="status-active">{groups.length}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon quaternary">📞</div>
                <div className="stat-content">
                  <h3>Contatos</h3>
                  <p className="status-active">{contacts.length}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon primary">📊</div>
                <div className="stat-content">
                  <h3>Mensagens Hoje</h3>
                  <p className="status-active">{messageStats.messagesFromAPI} {isUpdatingDispatch && '⏳'}</p>
                  <small>API Steinhq integrada</small>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon secondary">✅</div>
                <div className="stat-content">
                  <h3>Taxa de Sucesso</h3>
                  <p className="status-active">{messageStats.successRate}%</p>
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
                <div className="connection-section">
                  <div className="connection-actions">
                    {renderConnectionButton()}
                    <AntiBanSettingsModal />
                    
                    <div className="connection-config">
                      <h4>Configurações de Conexão</h4>
                      <div className="form-group">
                        <label htmlFor="phoneNumber">Número do WhatsApp (opcional):</label>
                        <input
                          type="text"
                          id="phoneNumber"
                          className="form-input"
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
                        <div className="info-item">
                          <label>Exclusão Próprio Número:</label>
                          <span className={antiBanSettings.excludeOwnNumber ? 'status-active' : 'status-inactive'}>
                            {antiBanSettings.excludeOwnNumber ? '✅ Ativada' : '❌ Desativada'}
                          </span>
                        </div>
                        <div className="info-item">
                          <label>Mensagens Hoje (API):</label>
                          <span className="status-active">{messageStats.messagesFromAPI}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2>Estatísticas Anti-Bloqueio</h2>
              </div>
              <div className="panel-body">
                <div className="info-grid">
                  <div className="info-item">
                    <label>Mensagens Esta Hora:</label>
                    <span>{messageStats.sentThisHour} / {antiBanSettings.maxHourlyMessages}</span>
                  </div>
                  <div className="info-item">
                    <label>Taxa de Sucesso:</label>
                    <span className={messageStats.successRate >= 90 ? 'status-active' : messageStats.successRate >= 70 ? 'status-waiting' : 'status-inactive'}>
                      {messageStats.successRate}%
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Proteções Ativas:</label>
                    <span>
                      {Object.values(antiBanSettings).filter(v => v === true).length} / 6
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Delay Configurado:</label>
                    <span>{antiBanSettings.minDelay}ms - {antiBanSettings.maxDelay}ms</span>
                  </div>
                  <div className="info-item">
                    <label>Tamanho do Lote:</label>
                    <span>{antiBanSettings.batchSize} mensagens</span>
                  </div>
                  <div className="info-item">
                    <label>Mensagens Hoje (API):</label>
                    <span className="status-success">{messageStats.messagesFromAPI} {isUpdatingDispatch && '⏳'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><h2>Informações da Instância</h2></div>
              <div className="panel-body">
                <div className="info-grid">
                  <div className="info-item">
                    <label>Nome:</label>
                    <span>{user.nome}</span>
                  </div>
                  <div className="info-item">
                    <label>Email:</label>
                    <span>{user.email}</span>
                  </div>
                  <div className="info-item">
                    <label>Instância:</label>
                    <span>{user.instancia}</span>
                  </div>
                  <div className="info-item">
                    <label>Plano:</label>
                    <span className="plan-badge">FluxoConnect Pro</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        );

      case 'groups':
        return (
          <div className="groups-container">
            <div className="group-create-card">
              <div className="card-header">
                <h3><span className="icon">➕</span> Criar Novo Grupo</h3>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <label htmlFor="groupName">Nome do Grupo:</label>
                  <input
                    type="text"
                    id="groupName"
                    className="form-input"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Digite o nome do grupo"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="participants">Participantes:</label>
                  <div className="input-with-tags">
                    <input
                      type="text"
                      id="participants"
                      className="form-input"
                      placeholder="Digite números separados por vírgula"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          const numbers = e.target.value.split(',').map(n => n.trim()).filter(n => n);
                          setNewGroupParticipants([...new Set([...newGroupParticipants, ...numbers])]);
                          e.target.value = '';
                        }
                      }}
                    />
                    <div className="input-tags">
                      {newGroupParticipants.map((participant, index) => {
                        const isOwn = isOwnNumber(participant);
                        return (
                          <span key={index} className={`tag ${isOwn ? 'own-number-tag' : ''}`}>
                            {participant}
                            {isOwn && <span className="own-indicator">🚫</span>}
                            <button
                              type="button"
                              className="tag-remove"
                              onClick={() => setNewGroupParticipants(newGroupParticipants.filter((_, i) => i !== index))}
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <small className="input-help">
                    Digite os números separados por vírgula e pressione Enter. Formato: 5511999999999 (com código do país)
                    {antiBanSettings.excludeOwnNumber && <><br/>🚫 <strong>Seu próprio número será automaticamente excluído</strong></>}
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
                  <span className="icon">📋</span> 
                  Todos os Grupos
                  <span className="badge">{filteredGroups.length}</span>
                </h3>
                <div className="search-box">
                  <input 
                    type="text" 
                    placeholder="Buscar grupos..." 
                    className="search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <span className="search-icon">🔍</span>
                </div>
              </div>
              
              {filteredGroups.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">👥</div>
                  <h4>
                    {searchTerm ? 'Nenhum grupo encontrado' : 'Ainda nenhum grupo'}
                  </h4>
                  <p>
                    {searchTerm ? 'Tente buscar com outros termos' : 'Conecte-se ao WhatsApp e crie seu primeiro grupo'}
                  </p>
                </div>
              ) : (
                <div className="groups-grid">
                  {filteredGroups.map(group => (
                    <div key={group.id} className="group-card">
                      <div className="group-avatar">
                        {group.subject?.charAt(0).toUpperCase() || 'G'}
                      </div>
                      <div className="group-info">
                        <h4 className="group-name">
                          {group.subject || 'Sem nome'}
                        </h4>
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
                        <button 
                          className="btn-icon btn-danger-icon" 
                          title="Sair do grupo"
                          onClick={() => leaveGroup(group.id, group.subject)}
                          disabled={isLeavingGroup}
                        >
                          {isLeavingGroup ? '⏳' : '🚪'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'messages':
        return (
          <div className="panel">
            <div className="panel-header">
              <h2>Envio de Mensagens com Proteção Anti-Bloqueio</h2>
              <div className="anti-ban-status">
                <span className="badge">🛡️ Proteção Ativa</span>
                <span className="badge">📊 {messageStats.messagesFromAPI} hoje</span>
                <span className="badge">✅ {messageStats.successRate}% sucesso</span>
              </div>
            </div>
            <div className="panel-body">
              {antiBanSettings.excludeOwnNumber && loggedNumber && (
                <div className="own-number-notice">
                  <div className="notice-icon">🚫</div>
                  <div className="notice-text">
                    <strong>Auto-Exclusão Ativada:</strong> 
                    <small>
                      Seu número ({api.utils.extractPhoneNumber(loggedNumber)}) será automaticamente excluído de todos os envios.
                    </small>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Mensagem:</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="form-textarea"
                  placeholder="Digite sua mensagem aqui..."
                  rows="4"
                />
              </div>
              
              <div className="message-targets">
                <div className="target-section">
                  <h3>Enviar para Grupo</h3>
                  <div className="form-group">
                    <select
                      value={selectedGroup}
                      onChange={(e) => setSelectedGroup(e.target.value)}
                      className="form-select"
                    >
                      <option value="">Selecione um grupo</option>
                      {filteredGroups.map(group => (
                        <option key={group.id} value={group.id}>
                          {group.subject}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="target-section">
                  <h3>Enviar para Contatos</h3>
                  <div className="form-group">
                    <select
                      multiple
                      value={selectedContacts}
                      onChange={(e) => setSelectedContacts(
                        Array.from(e.target.selectedOptions, option => option.value)
                      )}
                      className="form-select contacts-select"
                    >
                      {contacts.map(contact => {
                        const isOwn = isOwnNumber(contact.id);
                        return (
                          <option key={contact.id} value={contact.id} disabled={isOwn}>
                            {contact.name || contact.id} {isOwn ? '🚫 (Você)' : ''}
                          </option>
                        );
                      })}
                    </select>
                    <small className="input-help">
                      Mantenha Ctrl pressionado para selecionar múltiplos contatos
                      {antiBanSettings.excludeOwnNumber && <><br/>🚫 <strong>Seu próprio número aparece desabilitado</strong></>}
                    </small>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Envio em Massa para Participantes</label>
                <select
                  value={selectedGroupForBulk}
                  onChange={(e) => setSelectedGroupForBulk(e.target.value)}
                  className="form-select"
                >
                  <option value="">Selecione um grupo para envio em massa</option>
                  {filteredGroups.map(group => (
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
                      <><span className="spinner"></span> Enviando com proteção anti-bloqueio...</>
                    ) : (
                      '🚀 Enviar para TODOS os participantes (com proteção anti-bloqueio)'
                    )}
                  </button>
                )}
                
                <div className="security-notice">
                  <div className="security-icon">🛡️</div>
                  <div className="security-text">
                    <strong>Proteção Anti-Bloqueio Avançada:</strong> 
                    <small>
                      Delays inteligentes, rotação de user agents, processamento em lotes, 
                      monitoramento de qualidade, limites de envio, exclusão automática do próprio número
                      e contagem automática na API Steinhq.
                    </small>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={sendMessage} 
                className="btn btn-primary btn-block"
                disabled={isSending || (!selectedGroup && selectedContacts.length === 0)}
              >
                {isSending ? <><span className="spinner"></span>Enviando com Proteção...</> : '🛡️ Enviar Mensagem (Protegido + Auto-Exclusão)'}
              </button>
              
              {sendingStatus && <div className="status-message">{sendingStatus}</div>}
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
                <input type="text" value={user.nome} className="form-input" disabled />
              </div>
              
              <div className="form-group">
                <label>Email:</label>
                <input type="email" value={user.email} className="form-input" disabled />
              </div>
              
              <div className="form-group">
                <label>Instância:</label>
                <input type="text" value={user.instancia} className="form-input" disabled />
              </div>
              
              <div className="form-group">
                <label>Webhook (opcional):</label>
                <input 
                  type="text" 
                  defaultValue={user.webhook || ''} 
                  placeholder="URL do webhook"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Número Logado Detectado:</label>
                <input 
                  type="text" 
                  value={loggedNumber ? api.utils.extractPhoneNumber(loggedNumber) : 'Não detectado'} 
                  className="form-input"
                  disabled
                />
                <small className="input-help">
                  Este número será automaticamente excluído dos envios quando a opção estiver ativada.
                </small>
              </div>

              <div className="form-group">
                <label>Mensagens Hoje (API Steinhq):</label>
                <input 
                  type="text" 
                  value={`${messageStats.messagesFromAPI} mensagens registradas`} 
                  className="form-input"
                  disabled
                />
                <small className="input-help">
                  Contagem automática integrada com a API da Steinhq. Atualizada a cada envio.
                </small>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={antiBanSettings.excludeOwnNumber}
                    onChange={(e) => setAntiBanSettings({...antiBanSettings, excludeOwnNumber: e.target.checked})}
                  />
                  🚫 Excluir Próprio Número dos Envios
                </label>
                <small className="input-help">
                  Quando ativado, seu próprio número será automaticamente removido de todas as listas de envio.
                </small>
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
      {/* Mobile Menu Toggle */}
      <button 
        className="mobile-menu-toggle mobile-only"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        ☰
      </button>

      {/* Sidebar Navigation */}
      <div className={`sidebar ${sidebarOpen ? 'active' : ''}`}>
        <div className="sidebar-header">
          <h2>FluxoConnect Pro</h2>
        </div>
        <div className="sidebar-user">
          <div className="user-avatar">
            {user.nome.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <h4>{user.nome}</h4>
            <p>{user.email}</p>
            {loggedNumber && (
              <p className="logged-number-sidebar">📱 {api.utils.extractPhoneNumber(loggedNumber)}</p>
            )}
            <p className="dispatch-count-sidebar">📊 {messageStats.messagesFromAPI} mensagens</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          <ul>
            <li className={activeTab === 'dashboard' ? 'active' : ''}>
              <button onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}>
                <span className="icon">📊</span> <span>Dashboard</span>
              </button>
            </li>
            <li className={activeTab === 'groups' ? 'active' : ''}>
              <button onClick={() => { setActiveTab('groups'); setSidebarOpen(false); }}>
                <span className="icon">👥</span> <span>Grupos</span>
              </button>
            </li>
            <li className={activeTab === 'messages' ? 'active' : ''}>
              <button onClick={() => { setActiveTab('messages'); setSidebarOpen(false); }}>
                <span className="icon">✉️</span> <span>Mensagens</span>
              </button>
            </li>
            <li className={activeTab === 'settings' ? 'active' : ''}>
              <button onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}>
                <span className="icon">⚙️</span> <span>Configurações</span>
              </button>
            </li>
          </ul>
        </nav>
        <div className="sidebar-footer">
          <button onClick={onLogout} className="btn-logout">
            <span className="icon">🚪</span> <span>Sair</span>
          </button>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && <div className="sidebar-overlay mobile-only" onClick={() => setSidebarOpen(false)}></div>}

      {/* Main Content */}
      <div className="main-content">
        <header className="content-header">
          <h1>
            {activeTab === 'dashboard' && 'Dashboard FluxoConnect Pro'}
            {activeTab === 'groups' && 'Gerenciamento de Grupos'}
            {activeTab === 'messages' && 'Envio Protegido de Mensagens'}
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
            <div className="header-dispatch-count">
              <span className="dispatch-indicator">📊 {messageStats.messagesFromAPI}</span>
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

