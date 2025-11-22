const fs = require('fs');
const path = require('path');
const axios = require('axios');
const randomizer = require('./randomizer');
const HttpsProxyAgent = require('https-proxy-agent');

// =======================================================
// HELPERS
// =======================================================
function loadJson(name) {
  const file = path.join(__dirname, name);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJson(name, data) {
  const file = path.join(__dirname, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// =======================================================
// PROXY BUILDER
// =======================================================
function buildProxyAgent(instance) {
  if (
    !instance.proxyHost ||
    !instance.proxyPort ||
    !instance.proxyUser ||
    !instance.proxyPass
  ) {
    console.log(`[PROXY] Instância ${instance.nome}: sem proxy configurado.`);
    return null;
  }

  const proxyUrl = `http://${instance.proxyUser}:${instance.proxyPass}@${instance.proxyHost}:${instance.proxyPort}`;
  console.log(`[PROXY] Instância ${instance.nome}: usando ${proxyUrl}`);

  return new HttpsProxyAgent(proxyUrl);
}

// =======================================================
// AUTO-RECONNECT
// =======================================================
async function checkAndReconnectInstances() {
  const instances = loadJson('instancias.json');

  for (const instance of instances) {
    if (!instance.ativa) continue;

    const instanceId = instance.instanceId || instance.id;
    const token = instance.token;
    const baseUrl = instance.baseUrl || 'https://api.w-api.app/v1';

    if (!instanceId || !token) {
      console.log('[RECONNECT] Instância inválida, pulando.');
      continue;
    }

    const statusUrl = `${baseUrl}/instance/status-instance?instanceId=${instanceId}`;
    const restartUrl = `${baseUrl}/instance/restart?instanceId=${instanceId}`;

    const agent = buildProxyAgent(instance);

    try {
      const res = await axios.get(statusUrl, {
        headers: { Authorization: `Bearer ${token}` },
        httpsAgent: agent
      });

      const d = res.data || {};
      const connected =
        d.connected === true ||
        d.status === 'connected' ||
        d.connectionStatus === 'connected';

      if (connected) {
        console.log(`[RECONNECT] instancia ${instance.nome}: conectado.`);
        continue;
      }

      console.log(`[RECONNECT] ${instance.nome}: NÃO conectado, restart…`);

      await axios.get(restartUrl, {
        headers: { Authorization: `Bearer ${token}` },
        httpsAgent: agent
      });

    } catch (err) {
      console.log(`[RECONNECT] Erro ao checar ${instance.nome}`);
      if (err.response) console.log(err.response.data);
    }
  }
}

async function autoReconnectLoop() {
  while (true) {
    try {
      await checkAndReconnectInstances();
    } catch (e) {
      console.log('[AUTO RECONNECT] Erro geral:', e.message);
    }

    await wait(20000);
  }
}

// =======================================================
// ENVIO DE MENSAGEM (BUTTON URL)
// =======================================================
async function sendMessage(instance, phone, messageObj) {
  const instanceId = instance.instanceId || instance.id;
  const token = instance.token;
  const baseUrl = instance.baseUrl || 'https://api.w-api.app/v1';

  if (!instanceId || !token) {
    console.log('[ERRO AO ENVIAR] Instância sem ID ou token.');
    return false;
  }

  let baseText =
    messageObj.text ||
    messageObj.texto ||
    messageObj.message ||
    messageObj.msg ||
    messageObj.body ||
    null;

  if (!baseText) {
    console.log('[ERRO AO ENVIAR] Mensagem vazia.');
    return false;
  }

  let text = randomizer(baseText);

  let footer = '';
  if (messageObj.rodape) {
    footer = '\n\n' + randomizer(messageObj.rodape);
  }

  text = text + footer;

  const botao = messageObj.botao || {};
  const payload = {
    phone: phone,
    message: text,
    buttonActions: [
      {
        type: 'URL',
        buttonText: botao.texto || 'Acessar',
        url: botao.url || 'https://google.com'
      }
    ],
    delayMessage: 1
  };

  const url = `${baseUrl}/message/send-button-actions?instanceId=${instanceId}`;
  const agent = buildProxyAgent(instance);

  console.log('\n=================================');
  console.log('ENVIANDO PARA:', phone);
  console.log('Instance:', instanceId);

  try {
    const res = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      httpsAgent: agent
    });

    console.log('[OK]', res.status, res.data);
    return true;

  } catch (err) {
    console.log('[ERRO AO ENVIAR]');

    if (err.response) {
      console.log('Status:', err.response.status);
      console.log('Body:', err.response.data);
    } else {
      console.log(err.message);
    }

    return false;
  }
}

// =======================================================
// LOOP DE CAMPANHAS
// =======================================================
async function campaignLoop() {
  console.log('=== LOOP DE CAMPANHAS INICIADO ===');

  while (true) {
    let instances = loadJson('instancias.json');
    let mensagens = loadJson('mensagens.json');
    let campanhas = loadJson('campanhas.json');

    if (!Array.isArray(instances)) instances = [];
    if (!Array.isArray(mensagens)) mensagens = [];
    if (!Array.isArray(campanhas)) campanhas = [];

    for (let c = 0; c < campanhas.length; c++) {
      const campaign = campanhas[c];

      if (campaign.status === 'concluida') continue;

      if (!mensagens.length) {
        console.log('[CAMPANHA] Nenhuma mensagem cadastrada.');
        break;
      }

      const msgIndex =
        typeof campaign.messageIndex === 'number'
          ? campaign.messageIndex
          : 0;

      const msgTemplate = mensagens[msgIndex] || mensagens[0];
      if (!msgTemplate) continue;

      const numeros = Array.isArray(campaign.leads) ? campaign.leads : [];
      if (!numeros.length) {
        campaign.status = 'concluida';
        campanhas[c] = campaign;
        saveJson('campanhas.json', campanhas);
        continue;
      }

      let instanciasCampanha = [];
      if (Array.isArray(campaign.instancias) && campaign.instancias.length) {
        instanciasCampanha = campaign.instancias
          .map(i => instances[i])
          .filter(Boolean);
      } else if (Array.isArray(campaign.instanciaIds) && campaign.instanciaIds.length) {
        instanciasCampanha = campaign.instanciaIds
          .map(i => instances[i])
          .filter(Boolean);
      } else {
        instanciasCampanha = instances;
      }

      if (!instanciasCampanha.length) {
        console.log('[CAMPANHA] Nenhuma instância válida para', campaign.nome);
        continue;
      }

      const delayMin = campaign.delayMinMs || 2000;
      const delayMax = campaign.delayMaxMs || 4000;
      const pauseEnabled = !!campaign.pauseEnabled;
      const pauseAfter = campaign.pauseAfter || 0;
      const pauseTime = campaign.pauseTime || 0;

      if (typeof campaign.enviados !== 'number') campaign.enviados = 0;
      if (typeof campaign.erros !== 'number') campaign.erros = 0;
      campaign.status = 'em_andamento';
      campaign.total = numeros.length;

      for (let i = campaign.enviados; i < numeros.length; i++) {
        const phone = numeros[i];
        const instance = instanciasCampanha[i % instanciasCampanha.length];

        const ok = await sendMessage(instance, phone, msgTemplate);

        if (ok) campaign.enviados++;
        else campaign.erros++;

        campanhas[c] = campaign;
        saveJson('campanhas.json', campanhas);

        if (
          pauseEnabled &&
          pauseAfter > 0 &&
          pauseTime > 0 &&
          campaign.enviados > 0 &&
          campaign.enviados % pauseAfter === 0
        ) {
          console.log(
            `[PAUSE] Campanha ${campaign.nome}: pausa de ${pauseTime} ms após ${pauseAfter} envios.`
          );
          await wait(pauseTime);
        }

        const delay =
          Math.floor(Math.random() * (delayMax - delayMin)) + delayMin;
        await wait(delay);
      }

      campaign.status = 'concluida';
      campanhas[c] = campaign;
      saveJson('campanhas.json', campanhas);

      console.log('CAMPANHA FINALIZADA:', campaign.nome);
    }

    await wait(3000);
  }
}

// =======================================================
// START
// =======================================================
async function start() {
  campaignLoop().catch(err =>
    console.log('[MAIN] campaignLoop erro:', err.message)
  );

  autoReconnectLoop().catch(err =>
    console.log('[MAIN] autoReconnect erro:', err.message)
  );
}

start();
