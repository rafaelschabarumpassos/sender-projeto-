const express = require('express');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Caminhos dos arquivos
const INST_PATH = path.join(__dirname, 'instancias.json');
const MSG_PATH  = path.join(__dirname, 'mensagens.json');
const CAMP_PATH = path.join(__dirname, 'campanhas.json');

// Garante que os arquivos existem
if (!fs.existsSync(INST_PATH)) fs.writeFileSync(INST_PATH, '[]');
if (!fs.existsSync(MSG_PATH))  fs.writeFileSync(MSG_PATH, '[]');
if (!fs.existsSync(CAMP_PATH)) fs.writeFileSync(CAMP_PATH, '[]');

// Helpers
function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Erro lendo JSON:', filePath, e.message);
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ================================
// INSTÂNCIAS
// ================================
app.get('/api/instancias', (req, res) => {
  const data = readJson(INST_PATH, []);
  res.json(data);
});

app.post('/api/instancias/add', (req, res) => {
  const data = readJson(INST_PATH, []);

  data.push({
    nome: '',
    baseUrl: 'https://api.w-api.app/v1',
    instanceId: '',
    token: '',
    proxyHost: '',
    proxyPort: '',
    proxyUser: '',
    proxyPass: '',
    ativa: true
  });

  writeJson(INST_PATH, data);
  res.json({ message: 'Instância adicionada!' });
});

app.post('/api/instancias/save', (req, res) => {
  let instancias = [];

  if (Array.isArray(req.body)) {
    instancias = req.body;
  } else if (Array.isArray(req.body.instancias)) {
    instancias = req.body.instancias;
  }

  writeJson(INST_PATH, instancias);
  res.json({ message: 'Instâncias salvas com sucesso!' });
});

app.post('/api/instancias/delete', (req, res) => {
  const idx = req.body.idx;
  const data = readJson(INST_PATH, []);

  if (typeof idx !== 'number' || idx < 0 || idx >= data.length) {
    return res.status(400).json({ error: 'Índice inválido' });
  }

  data.splice(idx, 1);
  writeJson(INST_PATH, data);
  res.json({ message: 'Instância removida!' });
});

// ================================
// MÚLTIPLAS MENSAGENS
// ================================
app.get('/api/mensagens', (req, res) => {
  const msgs = readJson(MSG_PATH, []);
  res.json(msgs);
});

app.post('/api/mensagens/save', (req, res) => {
  const mensagens = Array.isArray(req.body.mensagens) ? req.body.mensagens : [];
  writeJson(MSG_PATH, mensagens);
  res.json({ message: 'Mensagens salvas!' });
});

// ================================
// CAMPANHAS
// ================================
app.get('/api/campanhas', (req, res) => {
  const campanhas = readJson(CAMP_PATH, []);
  res.json(campanhas);
});

app.post('/api/campanhas', (req, res) => {
  const campanhas = readJson(CAMP_PATH, []);

  const {
    nome,
    leads,
    instancias,
    delayMinMs,
    delayMaxMs,
    messageIndex,
    pauseEnabled,
    pauseAfter,
    pauseTime
  } = req.body || {};

  if (!nome || !Array.isArray(leads) || !leads.length) {
    return res.status(400).json({ error: 'Nome e lista de leads são obrigatórios.' });
  }

  const instanciaIds = Array.isArray(instancias) ? instancias : [];

  const novaCampanha = {
    id: Date.now().toString(),
    nome,
    status: 'pendente',
    enviados: 0,
    erros: 0,
    total: leads.length,
    leads,
    instancias: instanciaIds,        // índices das instâncias
    messageIndex: typeof messageIndex === 'number' ? messageIndex : 0,
    delayMinMs: delayMinMs || 2000,
    delayMaxMs: delayMaxMs || 4000,
    pauseEnabled: !!pauseEnabled,
    pauseAfter: pauseAfter || 0,
    pauseTime: pauseTime || 0,
    createdAt: Date.now()
  };

  campanhas.push(novaCampanha);
  writeJson(CAMP_PATH, campanhas);

  res.json({ message: 'Campanha criada!', campanha: novaCampanha });
});

// ================================
// FRONTEND
// ================================
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Healthcheck opcional
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Dashboard rodando na porta ${PORT}`);
});
