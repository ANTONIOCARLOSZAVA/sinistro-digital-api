const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // ✅ CORS - permite requisições de outros domínios
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Responde a preflight do navegador
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Apenas POST permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Apenas POST permitido' });
  }

  try {
    // Extrai dados do formulário
    const { nome, cpf, email, celular, senha, confirmarSenha, dataCriacao } = req.body;

    // ✅ VALIDAÇÕES
    if (!nome || !cpf || !email || !celular || !senha) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    if (senha !== confirmarSenha) {
      return res.status(400).json({ error: 'Senhas não conferem' });
    }

    // Pega as chaves de variáveis de ambiente (SEGURAS!)
    const KEY = process.env.AIRTABLE_API_KEY;
    const BASE = process.env.AIRTABLE_BASE_ID;
    const TABLE = process.env.AIRTABLE_TABLE;

    if (!KEY || !BASE) {
      return res.status(500).json({ error: 'Variáveis de ambiente não configuradas' });
    }

    // ✅ VERIFICA SE DADOS JÁ EXISTEM
    const filterFormula = encodeURIComponent(`OR({user_cpf}='${cpf}',{user_e-mail}='${email}',{user_mobile_nr}='${celular}')`);
    const filterURL = `https://api.airtable.com/v0/${BASE}/${TABLE}?filterByFormula=${filterFormula}`;
    
    const checkRes = await fetch(filterURL, {
      headers: { Authorization: `Bearer ${KEY}` }
    });
    const checkData = await checkRes.json();

    if (checkData.records && checkData.records.length > 0) {
      const usados = new Set();
      checkData.records.forEach(r => {
        if (r.fields['user_cpf'] === cpf) usados.add('CPF');
        if (r.fields['user_e-mail'] === email) usados.add('E-mail');
        if (r.fields['user_mobile_nr'] === celular) usados.add('Celular');
      });
      return res.status(409).json({ 
        error: `Campos já em uso: ${[...usados].join(', ')}`
      });
    }

    // ✅ CRIA NOVO REGISTRO
    const url = `https://api.airtable.com/v0/${BASE}/${TABLE}`;
    const createRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: [{
          fields: {
            user_name: nome.toUpperCase(),
            user_cpf: cpf,
            'user_e-mail': email,
            user_mobile_nr: celular,
            user_data_creation: dataCriacao,
            user_password: senha
          }
        }]
      })
    });

    const createData = await createRes.json();

    if (createData.records) {
      return res.status(201).json({ 
        success: true, 
        message: 'Cadastro realizado com sucesso!'
      });
    } else {
      return res.status(500).json({ 
        error: 'Erro ao criar cadastro',
        details: createData
      });
    }

  } catch (err) {
    console.error('Erro:', err);
    return res.status(500).json({ 
      error: 'Erro no servidor',
      message: err.message
    });
  }
};