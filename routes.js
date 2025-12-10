require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { getDatabase } = require("./database/config");
const { ObjectId } = require("mongodb");
const mongodb = require("mongodb");

const app = express();
const SECRET_KEY = "chave_secreta_aqui";

// Configuração do Multer para upload de imagens em memória
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Middlewares GLOBAIS ---
// O express.json() deve ser aplicado GLOBALMENTE antes de qualquer rota que use req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos da pasta 'assets'
app.use("/assets", express.static(path.join(__dirname, "assets")));

// --- Dados Mockados ---

// Usuário mockado para login
const MOCKED_USER = {
  email: "suporte@netcom.com",
  senha: "123",
  nome: "Suporte Netcom",
};
// --- Middlewares ESPECÍFICOS ---

/**
 * Middleware de restrição de acesso por dia da semana.
 * Permite acesso apenas de segunda a sexta-feira (dias 1 a 5).
 */
const acessoDiasUteis = (req, res, next) => {
  const data = new Date();
  const diaSemana = data.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado

  if (diaSemana >= 1 && diaSemana <= 5) {
    next(); // Permite o acesso
  } else {
    res
      .status(403)
      .json({ message: "Acesso permitido apenas de segunda a sexta-feira." });
  }
};

/**
 * Middleware de autenticação JWT.
 * Verifica se o token JWT está presente e é válido.
 */
const verificarToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null)
    return res.status(401).json({ message: "Token não encontrado" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: "Token expirado" });
    req.user = user; // Adiciona os dados do usuário ao request
    next();
  });
};

// --- Rotas ---

// POST /logar – Autenticação e geração de token JWT
app.post("/logar", (req, res) => {
  const { email, senha } = req.body;

  if (email === MOCKED_USER.email && senha === MOCKED_USER.senha) {
    // Gera o token JWT simulado
    const token = jwt.sign(
      { email: MOCKED_USER.email, nome: MOCKED_USER.nome },
      SECRET_KEY,
      { expiresIn: "9999d" }
    );
    return res.json({ token });
  }

  res.status(401).json({ message: "Credenciais inválidas" });
});

// Aplica o middleware de restrição de dias úteis APENAS às rotas protegidas
app.use("/chamados", acessoDiasUteis);
app.use("/relatorio", acessoDiasUteis);

// Aplica o middleware de verificação de token APENAS às rotas protegidas
app.use("/chamados", verificarToken);
app.use("/relatorio", verificarToken);

// GET /chamados – Retorna a lista de chamados
app.get("/chamados", async (req, res) => {
  try {
    const db = getDatabase();
    const chamados = await db.collection("chamados").find().toArray();

    if (chamados.length === 0)
      return res.status(404).json({ message: "Nenhum chamado encontrado" });

    const imageDir = path.join(__dirname, "assets", "images");
    const imageFiles = fs.readdirSync(imageDir);

    const chamadosComImagem = chamados.map((chamado) => {
      const idString = chamado._id.toString();
      const imageName = imageFiles.find((file) => file.startsWith(idString));

      let imageUrl = null;
      if (imageName) {
        imageUrl = `${req.protocol}://${req.get(
          "host"
        )}/assets/images/${imageName}`;
      }

      // Retorna o objeto do chamado com a nova propriedade imagePath
      return { ...chamado, imagePath: imageUrl };
    });

    return res.status(200).json(chamadosComImagem);
  } catch (e) {
    console.log(e);
    return res
      .status(500)
      .json({ message: e.message ?? "Erro ao recuperar os chamados" });
  }
});

// GET /chamados/:id – Busca um chamado específico pelo código (ID)
app.get("/chamados/:id", async (req, res) => {
  const id = req.params.id;

  const objectId = new mongodb.ObjectId(id);

  try {
    const db = getDatabase();
    const chamado = await db.collection("chamados").findOne({ _id: objectId });

    if (!chamado) {
      return res.status(404).json({ message: "Chamado não encontrado" });
    }

    const imageDir = path.join(__dirname, "assets", "images");
    const imageFiles = fs.readdirSync(imageDir);
    const idString = chamado._id.toString();
    const imageName = imageFiles.find((file) => file.startsWith(idString));

    let imageUrl = null;
    if (imageName) {
      imageUrl = `${req.protocol}://${req.get(
        "host"
      )}/assets/images/${imageName}`;
    }

    return res.status(200).json({ ...chamado, imagePath: imageUrl });
  } catch (e) {
    console.log(e);
    return res
      .status(500)
      .json({ message: e.message ?? "Erro ao recuperar o chamado" });
  }
});

// POST /chamados – Insere um novo chamado com imagem
app.post("/chamados", upload.single("imagem"), async (req, res) => {
  const { titulo, descricao, cliente } = req.body;

  if (!titulo || !descricao || !cliente) {
    return res
      .status(400)
      .json({ erro: "Título, descrição e cliente são obrigatórios." });
  }

  try {
    const db = getDatabase();

    const novoChamado = {
      titulo,
      descricao,
      status: "Aberto",
      cliente,
      dataAbertura: new Date().toISOString(),
    };

    const result = await db.collection("chamados").insertOne(novoChamado);
    const chamadoId = result.insertedId;

    if (req.file) {
      const fileExtension = path.extname(req.file.originalname);
      const filename = `${chamadoId}.${fileExtension}`;
      const directory = path.join(__dirname, "assets", "images");

      // Garante que o diretório exista
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      const imagePath = path.join(directory, filename);
      fs.writeFileSync(imagePath, req.file.buffer);
    }

    return res.status(201).json({
      message: "Chamado criado com sucesso.",
    });
  } catch (e) {
    console.log(e);
    return res
      .status(500)
      .json({ message: e.message ?? "Ocorreu um erro ao criar o chamado" });
  }
});

// DELETE /chamados/:id – Exclui um chamado pelo ID
app.delete("/chamados/:id", async (req, res) => {
  const paramId = req.params.id;
  const id = new mongodb.ObjectId(paramId);

  try {
    const db = getDatabase();
    const chamado = await db.collection("chamados").findOne({ _id: id });

    if (!chamado) {
      return res.status(404).json({ message: "Chamado não encontrado" });
    }

    if (chamado.imagem) {
      const imagePath = path.join(__dirname, chamado.imagem);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await db.collection("chamados").deleteOne({ _id: id });
    return res.status(200).json({ message: "Chamado excluído com sucesso." });
  } catch (e) {
    console.log(e);
    return res
      .status(500)
      .json({ message: e.message ?? "Ocorreu um erro ao excluir o chamado" });
  }
});

app.put("/chamados/:id", async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    // Campos que você quer permitir atualizar
    const { titulo, descricao, status, cliente } = req.body;

    const result = await db.collection("chamados").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          titulo,
          descricao,
          status,
          cliente,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Chamado não encontrado" });
    }

    return res
      .status(200)
      .json({ message: "Chamado atualizado com sucesso" });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ message: e.message ?? "Erro ao atualizar o chamado" });
  }
});

// GET /relatorio – Gera e disponibiliza para download um arquivo PDF
app.get("/relatorio", async (req, res) => {
  try {
    const db = getDatabase();

    const chamados = await db.collection("chamados").find().toArray();

    if (chamados.length === 0) {
      return res.status(404).json({ message: "Nenhum chamado encontrado" });
    }

    const doc = new PDFDocument();
    const filename = "relatorio_chamados.pdf";

    // Configura o cabeçalho para download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Pipe o PDF para a resposta HTTP
    doc.pipe(res);

    // Conteúdo do PDF
    doc
      .fontSize(25)
      .text("Relatório de Chamados - Netcom Telecom", { align: "center" });
    doc.moveDown();

    chamados.forEach((chamado) => {
      doc.fontSize(16).text(`ID: ${chamado._id} - Título: ${chamado.titulo}`, {
        underline: true,
      });
      doc.fontSize(12).text(`Cliente: ${chamado.cliente}`);
      doc.text(`Status: ${chamado.status}`);
      doc.text(`Descrição: ${chamado.descricao}`);
      doc.moveDown();
    });

    // Finaliza o PDF
    doc.end();
  } catch (e) {
    console.log(e);
    return res
      .status(500)
      .json({ message: e.message ?? "Ocorreu um erro ao gerar o relatório" });
  }
});

module.exports = app;
