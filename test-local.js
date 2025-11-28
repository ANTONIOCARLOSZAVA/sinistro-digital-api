require('dotenv').config();
const cadastro = require('./api/cadastro');

// Mock do objeto req (requisição)
const req = {
  method: 'POST',
  body: {
    nome: 'João Silva',
    cpf: '12345678900',
    email: 'joao@example.com',
    celular: '11999999999',
    senha: 'Senha123!',
    confirmarSenha: 'Senha123!',
    dataCriacao: new Date().toISOString()
  }
};

// Mock do objeto res (resposta)
const res = {
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    console.log(`Status: ${this.statusCode}`);
    console.log('Resposta:', JSON.stringify(data, null, 2));
    return this;
  },
  setHeader: function(key, value) {
    console.log(`Header: ${key} = ${value}`);
  },
  end: function() {
    console.log('Requisição finalizada');
  }
};

// Executa o teste
console.log('🧪 Iniciando teste...\n');
cadastro(req, res).catch(err => console.error('Erro:', err));