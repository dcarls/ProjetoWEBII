const app = require("./routes")
const database = require("./database/config");

const PORT = 3000;

// --- Inicialização do Servidor ---
const startServer = async () => {
  await database.connectDatabase();

  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log("Rotas disponíveis:");
    console.log("POST /logar (Acesso livre)");
    console.log("--- Rotas com restrição de dia útil e JWT ---");
    console.log("GET /chamados");
    console.log("POST /chamados");
    console.log("DELETE /chamados/:id");
    console.log("GET /chamados/:id");
    console.log("GET /relatorio (Gera PDF)");
  });
};

startServer();