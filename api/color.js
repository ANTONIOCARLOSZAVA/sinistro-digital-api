// api/color.js

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const jwt = require('jsonwebtoken');

// Variáveis de Ambiente
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || 'pat7Fr95IafXlfz70.7591405d50052ae10ca5292c0571bd2e5cb587672b10acee5eee35832437f31a';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appgXSYZTHcWbipyH';
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE || 'portal_users_cad';
const JWT_SECRET = process.env.JWT_SECRET || 'XyZ9kL2mN5pQr8sT1uVwX0yZaBcDeFgHiJkLmNoPqRsT';

// Função auxiliar para validar token JWT e extrair email
async function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.email) {
      console.warn('Token decodificado inválido ou sem email:', decoded);
      return null;
    }
    return decoded.email;
  } catch (err) {
    console.error('Erro na verificação do token JWT:', err.message);
    return null;
  }
}

// Função auxiliar para validar formato HEX da cor
function isValidHexColor(hex) {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
}

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // --- POST /api/color: Salvar cor do usuário ---
    if (req.method === 'POST') {
      const { token, baseColor } = req.body;  // ← MUDOU: "color" para "baseColor"

      if (!token || !baseColor) {
        console.log('POST /api/color: Token ou cor ausentes na requisição.');
        return res.status(400).json({ error: 'Token e baseColor são obrigatórios.' });
      }
      if (!isValidHexColor(baseColor)) {
        console.log('POST /api/color: Formato de cor inválido:', baseColor);
        return res.status(400).json({ error: 'Formato de cor hexadecimal inválido.' });
      }

      const userEmail = await verifyToken(token);
      if (!userEmail) {
        console.log('POST /api/color: Token inválido ou expirado.');
        return res.status(401).json({ error: 'Não autorizado: Token inválido ou expirado.' });
      }

      console.log(`POST /api/color: Tentando salvar cor '${baseColor}' para o email '${userEmail}'.`);

      // 1. Buscar o ID do registro do usuário no Airtable
      const filterURL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}?filterByFormula={user_e_mail}='${userEmail}'`;
      const getRes = await fetch(filterURL, {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
      });
      const getData = await getRes.json();

      if (!getData.records || getData.records.length === 0) {
        console.warn('POST /api/color: Usuário não encontrado no Airtable:', userEmail);
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      const userId = getData.records[0].id;

      // 2. Atualizar o campo baseColor para o usuário encontrado
      const updateURL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}`;
      const updateRes = await fetch(updateURL, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          records: [{
            id: userId,
            fields: {
              baseColor: baseColor  // ← MUDOU: "color" para "baseColor"
            }
          }]
        })
      });
      const updateData = await updateRes.json();

      if (!updateRes.ok) {
        console.error('POST /api/color: Erro ao atualizar Airtable:', updateData);
        return res.status(500).json({ error: 'Erro ao salvar a cor no Airtable.' });
      }

      console.log(`POST /api/color: Cor '${baseColor}' salva com sucesso para o email '${userEmail}'.`);
      return res.status(200).json({ success: true, baseColor: baseColor });  // ← MUDOU: "color" para "baseColor"
    }

    // --- GET /api/color: Recuperar cor do usuário ---
    else if (req.method === 'GET') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('GET /api/color: Header de autorização ausente ou inválido.');
        return res.status(401).json({ error: 'Não autorizado: Token Bearer é obrigatório.' });
      }

      const token = authHeader.split(' ')[1];
      const userEmail = await verifyToken(token);
      if (!userEmail) {
        console.log('GET /api/color: Token inválido ou expirado.');
        return res.status(401).json({ error: 'Não autorizado: Token inválido ou expirado.' });
      }

      console.log(`GET /api/color: Tentando recuperar cor para o email '${userEmail}'.`);

      // Buscar a cor do usuário no Airtable
      const filterURL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}?filterByFormula={user_e_mail}='${userEmail}'`;
      const getRes = await fetch(filterURL, {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
      });
      const getData = await getRes.json();

      if (!getData.records || getData.records.length === 0) {
        console.warn('GET /api/color: Usuário não encontrado no Airtable:', userEmail);
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      const baseColor = getData.records[0].fields.baseColor || null;
      console.log(`GET /api/color: Cor recuperada para '${userEmail}': ${baseColor}`);
      return res.status(200).json({ success: true, baseColor: baseColor });  // ← MUDOU: "color" para "baseColor"
    }

    // --- Método não permitido ---
    else {
      console.log(`Método ${req.method} não permitido para /api/color.`);
      res.setHeader('Allow', ['POST', 'GET', 'OPTIONS']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

  } catch (err) {
    console.error('Erro no servidor para /api/color:', err);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: err.message
    });
  }
}; 
