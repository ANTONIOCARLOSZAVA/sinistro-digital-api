const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

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

    // ✅ VALIDAÇÕES BÁSICAS
    if (!nome || !cpf || !email || !celular || !senha) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    // ✅ VALIDAÇÃO DE NOME
    if (nome.trim().length < 3) {
      return res.status(400).json({ error: 'Nome deve ter pelo menos 3 caracteres' });
    }

    // ✅ VALIDAÇÃO DE CPF
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      return res.status(400).json({ error: 'CPF deve conter 11 dígitos' });
    }
    
    function validarCPF(s) {
      if (["00000000000","11111111111","22222222222"].includes(s)) return false;
      let soma = 0, resto;
      for (let i = 1; i <= 9; i++) {
        soma += parseInt(s.substring(i-1,i)) * (11-i);
      }
      resto = (soma * 10) % 11;
      if (resto === 10 || resto === 11) resto = 0;
      if (resto !== parseInt(s.substring(9,10))) return false;
      soma = 0;
      for (let i = 1; i <= 10; i++) {
        soma += parseInt(s.substring(i-1,i)) * (12-i);
      }
      resto = (soma * 10) % 11;
      if (resto === 10 || resto === 11) resto = 0;
      return resto === parseInt(s.substring(10,11));
    }
    
    if (!validarCPF(cpfLimpo)) {
      return res.status(400).json({ error: 'CPF inválido' });
    }

    // ✅ VALIDAÇÃO DE EMAIL
    const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!reEmail.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    // ✅ VALIDAÇÃO DE CELULAR
    const celularLimpo = celular.replace(/\D/g, '');
    if (celularLimpo.length < 11) {
      return res.status(400).json({ error: 'Celular deve ter pelo menos 11 dígitos' });
    }

    // ✅ VALIDAÇÃO DE SENHAS
    if (senha !== confirmarSenha) {
      return res.status(400).json({ error: 'Senhas não conferem' });
    }

    const reSenha = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
    if (!reSenha.test(senha)) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres, incluir um número, uma letra maiúscula, uma letra minúscula e um caractere especial.' });
    }

    // Pega as chaves de variáveis de ambiente (SEGURAS!)
    const KEY = process.env.AIRTABLE_API_KEY;
    const BASE = process.env.AIRTABLE_BASE_ID;
    const TABLE = process.env.AIRTABLE_TABLE;

    if (!KEY || !BASE) {
      return res.status(500).json({ error: 'Variáveis de ambiente não configuradas' });
    }

    // ✅ VERIFICA SE DADOS JÁ EXISTEM
    const filterFormula = encodeURIComponent(`OR({user_cpf}='${cpfLimpo}',{user_e-mail}='${email}',{user_mobile_nr}='${celularLimpo}')`);
    const filterURL = `https://api.airtable.com/v0/${BASE}/${TABLE}?filterByFormula=${filterFormula}`;
    
    const checkRes = await fetch(filterURL, {
      headers: { Authorization: `Bearer ${KEY}` }
    });
    const checkData = await checkRes.json();

    if (checkData.records && checkData.records.length > 0) {
      const usados = new Set();
      checkData.records.forEach(r => {
        if (r.fields['user_cpf'] === cpfLimpo) usados.add('CPF');
        if (r.fields['user_e-mail'] === email) usados.add('E-mail');
        if (r.fields['user_mobile_nr'] === celularLimpo) usados.add('Celular');
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
            user_cpf: cpfLimpo,
            'user_e-mail': email,
            user_mobile_nr: celularLimpo,
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