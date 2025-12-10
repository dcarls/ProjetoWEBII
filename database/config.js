const { MongoClient } = require('mongodb')

let db = null

const MONGO_URI = process.env.MONGO_URI ?? ''
const MONGO_DB = process.env.MONGO_DB

async function connectDatabase() {
  const client = new MongoClient(MONGO_URI)
  try {
    await client.connect()
    console.log("Banco de dados conectado!")

    db = client.db(MONGO_DB)
  } catch (e) {
    console.log('[ERRO] Ocorreu um erro ao conectar com o banco de dados.')
    console.log(e)
  }
}

const getDatabase = () => db

module.exports = { connectDatabase, getDatabase }