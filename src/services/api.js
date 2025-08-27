// src/services/api.js - Versão Final com Parâmetro Search Correto
import axios from 'axios';

// URLs base das APIs
const STEINHQ_BASE_URL = 'https://api.steinhq.com/v1/storages/68ad1d03affba40a62f25e10';
const WHATSAPP_BASE_URL = 'https://evo.fluxodigitaltech.com.br';

// Configuração do axios para Steinhq
const steinhqAPI = axios.create({
  baseURL: STEINHQ_BASE_URL,
  timeout: 10000,
});

// Configuração do axios para WhatsApp
const whatsappAPI = axios.create({
  baseURL: WHATSAPP_BASE_URL,
  timeout: 30000,
});

// Interceptors para tratamento de erros
steinhqAPI.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Erro na requisição Steinhq API:', error);
    throw error;
  }
);

whatsappAPI.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Erro na requisição WhatsApp API:', error);
    throw error;
  }
);

// Função para criar headers do WhatsApp (SEM User-Agent para evitar erro)
const createWhatsAppHeaders = (apiKey) => {
  return {
    'apikey': apiKey,
    'Content-Type': 'application/json'
  };
};

// ==================== AUTH API ====================
export const authAPI = {
  login: (email) => steinhqAPI.get(`/login?email=${encodeURIComponent(email)}`),
  register: (userData) => steinhqAPI.post('/login', [userData]),
  checkEmail: (email) => steinhqAPI.get(`/login?email=${encodeURIComponent(email)}`)
};

// ==================== DISPATCH API (STEINHQ) - VERSÃO FINAL COM SEARCH ====================
export const dispatchAPI = {
  // Buscar registro específico por ID do cliente usando parâmetro search (CORRETO)
  getByClientId: async (clientId) => {
    try {
      console.log(`📊 Buscando disparo para cliente: ${clientId}`);
      
      // Usar parâmetro search conforme documentação Steinhq
      const searchParam = JSON.stringify({ id: clientId });
      const response = await steinhqAPI.get(`/disparo?search=${encodeURIComponent(searchParam)}`);
      
      console.log(`📊 Resposta da API:`, response.data);
      
      if (response.data && response.data.length > 0) {
        const record = response.data[0];
        console.log(`📊 Registro encontrado:`, record);
        return record;
      } else {
        console.log(`📊 Nenhum registro encontrado para cliente: ${clientId}`);
        return null;
      }
    } catch (error) {
      console.error('Erro ao buscar registro de disparo:', error);
      return null;
    }
  },
  
  // Atualizar contagem de disparo (PUT) - usando search para encontrar o registro
  update: async (clientId, newCount) => {
    try {
      console.log(`📊 Atualizando disparo para cliente ${clientId}: ${newCount}`);
      
      // Primeiro, buscar o registro para obter o índice correto
      const searchParam = JSON.stringify({ id: clientId });
      const searchResponse = await steinhqAPI.get(`/disparo?search=${encodeURIComponent(searchParam)}`);
      
      if (searchResponse.data && searchResponse.data.length > 0) {
        // Usar PUT com o ID específico
        const response = await steinhqAPI.put(`/disparo/${clientId}`, {
          disparo: newCount.toString()
        });
        
        console.log(`✅ Disparo atualizado com sucesso`);
        return response.data;
      } else {
        throw new Error(`Registro não encontrado para cliente ${clientId}`);
      }
    } catch (error) {
      console.error('Erro ao atualizar disparo:', error);
      throw error;
    }
  },
  
  // Criar novo registro de disparo (POST)
  create: async (clientId, initialCount = 1) => {
    try {
      console.log(`📊 Criando novo registro de disparo para cliente ${clientId}: ${initialCount}`);
      
      const response = await steinhqAPI.post('/disparo', {
        id: clientId,
        disparo: initialCount.toString()
      });
      
      console.log(`✅ Registro criado com sucesso`);
      return response.data;
    } catch (error) {
      console.error('Erro ao criar registro de disparo:', error);
      throw error;
    }
  },
  
  // Incrementar contagem de disparo (usa search para buscar)
  increment: async (clientId, incrementBy = 1) => {
    try {
      console.log(`📊 Incrementando disparo para cliente ${clientId} em ${incrementBy}`);
      
      // Buscar registro atual usando search
      const currentRecord = await dispatchAPI.getByClientId(clientId);
      
      if (currentRecord) {
        // Registro existe - fazer PUT
        const currentCount = currentRecord.disparo === null || currentRecord.disparo === undefined ? 0 : parseInt(currentRecord.disparo) || 0;
        const newCount = currentCount + incrementBy;
        
        console.log(`📊 Atualizando de ${currentCount} para ${newCount}`);
        await dispatchAPI.update(clientId, newCount);
        return newCount;
      } else {
        // Registro não existe - fazer POST
        console.log(`📊 Criando novo registro com ${incrementBy} disparos`);
        await dispatchAPI.create(clientId, incrementBy);
        return incrementBy;
      }
    } catch (error) {
      console.error('Erro ao incrementar disparo:', error);
      throw error;
    }
  },
  
  // Obter contagem atual de disparo para um cliente (usa search)
  getCount: async (clientId) => {
    try {
      console.log(`📊 Obtendo contagem para cliente: ${clientId}`);
      
      const record = await dispatchAPI.getByClientId(clientId);
      if (record) {
        const count = record.disparo === null || record.disparo === undefined ? 0 : parseInt(record.disparo) || 0;
        console.log(`📊 Contagem obtida: ${count}`);
        return count;
      }
      
      console.log(`📊 Nenhum registro encontrado, retornando 0`);
      return 0;
    } catch (error) {
      console.error('Erro ao obter contagem de disparo:', error);
      return 0;
    }
  }
};

// ==================== WHATSAPP INSTANCE API ====================
export const instanceAPI = {
  // Verificar estado da conexão (SEM User-Agent)
  checkConnectionState: async (instanceId, apiKey) => {
    try {
      const headers = createWhatsAppHeaders(apiKey);
      const response = await whatsappAPI.get(`/instance/connectionState/${instanceId}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Erro ao verificar estado da conexão:', error);
      throw error;
    }
  },
  
  // Conectar instância (SEM User-Agent)
  connect: async (instanceId, apiKey) => {
    try {
      const headers = createWhatsAppHeaders(apiKey);
      const response = await whatsappAPI.get(`/instance/connect/${instanceId}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Erro ao conectar instância:', error);
      throw error;
    }
  },
  
  // Criar instância (SEM User-Agent)
  create: async (instanceData, apiKey) => {
    try {
      const headers = createWhatsAppHeaders(apiKey);
      const response = await whatsappAPI.post('/instance/create', instanceData, { headers });
      return response.data;
    } catch (error) {
      console.error('Erro ao criar instância:', error);
      throw error;
    }
  },
  
  // Fazer logout da instância (SEM User-Agent)
  logout: async (instanceId, apiKey) => {
    try {
      const headers = createWhatsAppHeaders(apiKey);
      const response = await whatsappAPI.delete(`/instance/logout/${instanceId}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Erro ao fazer logout da instância:', error);
      throw error;
    }
  }
};

// ==================== WHATSAPP GROUPS API ====================
export const groupsAPI = {
  // Buscar todos os grupos (SEM User-Agent)
  fetchAll: async (instanceId, apiKey, getParticipants = true) => {
    try {
      const headers = createWhatsAppHeaders(apiKey);
      const response = await whatsappAPI.get(
        `/group/fetchAllGroups/${instanceId}?getParticipants=${getParticipants}`, 
        { headers }
      );
      return response.data || [];
    } catch (error) {
      console.error('Erro ao buscar grupos:', error);
      return [];
    }
  },
  
  // Buscar informações de um grupo específico (SEM User-Agent)
  getInfo: async (instanceId, groupJid, apiKey) => {
    try {
      const headers = createWhatsAppHeaders(apiKey);
      const response = await whatsappAPI.get(
        `/group/findGroupInfos/${instanceId}?groupJid=${encodeURIComponent(groupJid)}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar informações do grupo:', error);
      throw error;
    }
  },
  
  // Criar grupo (SEM User-Agent)
  create: async (instanceId, groupData, apiKey) => {
    try {
      const headers = createWhatsAppHeaders(apiKey);
      const response = await whatsappAPI.post(`/group/create/${instanceId}`, groupData, { headers });
      return response.data;
    } catch (error) {
      console.error('Erro ao criar grupo:', error);
      throw error;
    }
  },
  
  // Sair do grupo (SEM User-Agent)
  leave: async (instanceId, groupJid, apiKey) => {
    try {
      const headers = createWhatsAppHeaders(apiKey);
      const response = await whatsappAPI.delete(
        `/group/leaveGroup/${instanceId}?groupJid=${encodeURIComponent(groupJid)}`,
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error('Erro ao sair do grupo:', error);
      throw error;
    }
  }
};

// ==================== WHATSAPP CONTACTS API ====================
export const contactsAPI = {
  // Buscar todos os contatos (SEM User-Agent)
  fetchAll: async (instanceId, apiKey) => {
    try {
      const headers = createWhatsAppHeaders(apiKey);
      const response = await whatsappAPI.get(`/chat/fetchContacts/${instanceId}`, { headers });
      return response.data?.contacts || [];
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      return [];
    }
  }
};

// ==================== WHATSAPP MESSAGES API ====================
export const messagesAPI = {
  // Enviar mensagem de texto (SEM User-Agent)
  sendText: async (instanceId, messageData, apiKey) => {
    try {
      const headers = createWhatsAppHeaders(apiKey);
      const response = await whatsappAPI.post(`/message/sendText/${instanceId}`, messageData, { headers });
      return response.data;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      throw error;
    }
  }
};

// ==================== UTILITY FUNCTIONS ====================
export const apiUtils = {
  // Validar e formatar número de telefone
  validateAndFormatPhoneNumber: (number) => {
    if (!number) return null;
    let formattedNumber = number.replace(/[^\d@\.\-]/g, '');
    if (!/^\d+/.test(formattedNumber)) return null;
    return formattedNumber;
  },
  
  // Extrair número do ID do WhatsApp
  extractPhoneNumber: (whatsappId) => {
    if (!whatsappId) return null;
    return whatsappId.split('@')[0];
  },
  
  // Normalizar números para comparação
  normalizePhoneNumber: (number) => {
    if (!number) return '';
    const cleaned = number.toString().replace(/\D/g, '');
    if (cleaned.startsWith('55') && cleaned.length > 11) {
      return cleaned.substring(2);
    }
    return cleaned;
  },
  
  // Criar headers para WhatsApp (SEM User-Agent)
  createWhatsAppHeaders,
  
  // Criar URL de search para Steinhq
  createSearchUrl: (endpoint, searchObject) => {
    const searchParam = JSON.stringify(searchObject);
    return `${endpoint}?search=${encodeURIComponent(searchParam)}`;
  }
};

// Exportação padrão com todas as APIs
export default {
  auth: authAPI,
  dispatch: dispatchAPI,
  instance: instanceAPI,
  groups: groupsAPI,
  contacts: contactsAPI,
  messages: messagesAPI,
  utils: apiUtils
};

