const request = require('supertest');
const app = require('../routes')
const { connectDatabase } = require('../database/config');

const userCredentials = {
  email: 'suporte@netcom.com',
  senha: '123',
};

describe('Testando autenticacão', () => {
  it('Deve autenticar usuário e retornar token JWT', async () => {
    const response = await request(app)
      .post('/logar')
      .send({ email: userCredentials.email, senha: userCredentials.senha });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });

  it('Não deve autenticar com credenciais inválidas', async () => {
    const response = await request(app)
      .post('/logar')
      .send({ email: 'invalido@netcom.com', senha: 'senha_invalida' });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message', 'Credenciais inválidas');
  });

})

describe('Testando middleware de autenticação JWT', () => {
  let token;
  beforeAll(async () => {
    await connectDatabase();

    const response = await request(app)
      .post('/logar')
      .send({ email: userCredentials.email, senha: userCredentials.senha });
    token = response.body.token;
  });

  it('Deve permitir acesso a rota protegida com token válido', async () => {
    const response = await request(app)
      .get('/chamados')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
  });

  it('Deve negar acesso a rota protegida sem token', async () => {
    const response = await request(app)
      .get('/chamados');
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message', 'Token não encontrado');
  });

  it('Deve negar acesso a rota protegida com token inválido', async () => {
    const response = await request(app)
      .get('/chamados')
      .set('Authorization', 'Bearer token_invalido');
    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message', 'Token expirado');
  });
});

describe('Testando middleware de restrição de dias úteis', () => {
  let token;
  beforeAll(async () => {
    await connectDatabase();
    const response = await request(app)
      .post('/logar')
      .send({ email: userCredentials.email, senha: userCredentials.senha });
    token = response.body.token;
  });

  it('Deve permitir acesso em dia útil', async () => {
    const realDateNow = Date.now.bind(global.Date);
    const segundaFeira = new Date('2025-12-01T10:00:00Z').getTime();
    global.Date.now = jest.fn(() => segundaFeira);
    const response = await request(app)
      .get('/chamados')
      .set('Authorization', `Bearer ${token}`);
    global.Date.now = realDateNow;
    expect(response.status).toBe(200);
  });

  it('Deve negar acesso em fim de semana', async () => {
    const realDateNow = Date.now.bind(global.Date);
    const domingo = new Date('2025-11-30T10:00:00Z').getTime();
    global.Date.now = jest.fn(() => domingo);
    const response = await request(app)
      .get('/chamados')
      .set('Authorization', `Bearer ${token}`);
    global.Date.now = realDateNow;
    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message', 'Acesso permitido apenas de segunda a sexta-feira.');
  });
});

describe('Testando rotas de chamados', () => {
  let token;
  beforeAll(async () => {
    await connectDatabase();
    const response = await request(app)
      .post('/logar')
      .send({ email: userCredentials.email, senha: userCredentials.senha });
    token = response.body.token;
  });

  it('Deve criar um novo chamado', async () => {
    const novoChamado = {
      titulo: 'Teste de chamado',
      descricao: 'Descrição do chamado de teste',
      cliente: 'Cliente Teste',
    };
    const response = await request(app)
      .post('/chamados')
      .set('Authorization', `Bearer ${token}`)
      .send(novoChamado);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('message', 'Chamado criado com sucesso.');
  });

  it('Deve listar chamados', async () => {
    const response = await request(app)
      .get('/chamados')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('Deve recuperar um chamado por ID', async () => {
    const chamadosResponse = await request(app)
      .get('/chamados')
      .set('Authorization', `Bearer ${token}`);
    const chamadoId = chamadosResponse.body[chamadosResponse.body.length - 1]._id;
    const response = await request(app)
      .get(`/chamados/${chamadoId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body._id).toBe(chamadoId);
  });

  it('Deve excluir um chamado por ID', async () => {
    const chamadosResponse = await request(app)
      .get('/chamados')
      .set('Authorization', `Bearer ${token}`);
    const chamadoId = chamadosResponse.body[chamadosResponse.body.length - 1]._id;
    const response = await request(app)
      .delete(`/chamados/${chamadoId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Chamado excluído com sucesso.');
  });

  it('Deve gerar relatório em PDF', async () => {
    const response = await request(app)
      .get('/relatorio')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
  });
});