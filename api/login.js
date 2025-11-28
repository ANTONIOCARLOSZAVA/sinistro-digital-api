const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  // ✅ CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Apenas POST permitido' });
  }

  try {
    const { email, senha } = req.body;

    // ✅ VALIDAÇÕES BÁSICAS
    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // ✅ VALIDAÇÃO DE EMAIL
    const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!reEmail.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    // Pega as chaves de variáveis de ambiente (SEGURAS!)
    const KEY = process.env.AIRTABLE_API_KEY;
    const BASE = process.env.AIRTABLE_BASE_ID;
    const TABLE = process.env.AIRTABLE_TABLE;
    const JWT_SECRET = process.env.JWT_SECRET || 'seu-secret-super-seguro-aqui';

    if (!KEY || !BASE) {
      return res.status(500).json({ error: 'Variáveis de ambiente não configuradas' });
    }

    // ✅ BUSCA USUÁRIO NO AIRTABLE
    const filterFormula = encodeURIComponent(`AND({user_e-mail}='${email}',{user_password}='${senha}')`);
    const filterURL = `https://api.airtable.com/v0/${BASE}/${TABLE}?filterByFormula=${filterFormula}`;
    
    const checkRes = await fetch(filterURL, {
      headers: { Authorization: `Bearer ${KEY}` }
    });
    const checkData = await checkRes.json();

    if (!checkData.records || checkData.records.length === 0) {
      return res.status(401).json({ error: 'Usuário e/ou senha informada inválidos!' });
    }

    // ✅ USUÁRIO ENCONTRADO - GERA TOKEN
    const usuario = checkData.records[0].fields;
    const token = jwt.sign(
      {
        id: checkData.records[0].id,
        email: usuario.user_e_mail || usuario['user_e-mail'],
        nome: usuario.user_name
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      token: token,
      usuario: {
        nome: usuario.user_name,
        email: usuario.user_e_mail || usuario['user_e-mail']
      }
    });

  } catch (err) {
    console.error('Erro:', err);
    return res.status(500).json({
      error: 'Erro no servidor',
      message: err.message
    });
  }
};