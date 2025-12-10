
# Projeto WEBII - API de Chamados

Este projeto é uma API REST desenvolvida em Node.js com Express e MongoDB Atlas, criada para gerenciar chamados de suporte técnico.  
A API permite criar, listar, atualizar, excluir e gerar relatórios em PDF dos chamados cadastrados.

## Funcionalidades
- Autenticação JWT
- CRUD completo de chamados
- Geração de relatório em PDF
- Testes automatizados com Jest

## Como executar
1. Instale dependências:
   npm install

2. Configure o arquivo .env:
   JWT_SECRET=seu_token
   MONGODB_URI=sua_string_atlas

3. Inicie o servidor:
   npm run dev

## Rotas
- POST /logar
- POST /chamados
- GET /chamados
- GET /chamados/:id
- PUT /chamados/:id
- DELETE /chamados/:id
- GET /relatorio
