import express  from "express";
import logger from "morgan" 
import dotenv from "dotenv"
import { createClient } from "@libsql/client";
import { Server } from "socket.io";
import {createServer} from "node:http"

dotenv.config()
const port = process.env.PORT ?? 1122
const app = express()
const server = createServer(app)
const io = new Server(server,{
    connectionStateRecovery:{}
})
//url local http://localhost:1122
//url desplegada https://chat-ksi6.onrender.com
// token  eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3MTA2MTcwMTUsImlkIjoiNzBkZWZiMDAtZWFlMi00MTJlLWEzZmYtODBlODNiNTRkYTA5In0.ce3ho8HJprBEJw_Sr_VmtdQvAxIlUTP2MRxkQvtr1F7Yv0q7n-F4OqepvxcThtqk3Mqg_yASVCTjAImPRD_PAA
// url    libsql://prueba-juanma-9.turso.io
// IDENTIFICACIÓN  70defb00-eae2-412e-a3ff-80e83b54da09
// nombre bd  prueba

const db = createClient({
    url: 'libsql://prueba-juanma-9.turso.io',
    authToken: process.env.DB_TOKEN
  })
  
  await db.execute(`
  CREATE TABLE IF NOT EXISTS messagess (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    username TEXT
  )
`)
  
  io.on('connection', async (socket) => {
    console.log('a user has connected!')
  
    socket.on('disconnect', () => {
      console.log('an user has disconnected')
    })
  
    // eliminar mensajes ,hacer que al eliminar se borre el msj del cliente
    socket.on('clear messages', async () => {
      try {
        await db.execute('DELETE FROM messagess');
        io.emit('messages cleared');
      } catch (error) {
        console.error('Error al borrar mensajes:', error);
      }
    });
    

    socket.on('chat message', async (msg) => {
      let result
      const username = socket.handshake.auth.username ?? 'anonymous'
      console.log({ username })
      try {
        result = await db.execute({
          sql: 'INSERT INTO messagess (content, user) VALUES (:msg, :username)',
          args: { msg, username }
        })
      } catch (e) {
        console.error(e)
        return
      }
  
      io.emit('chat message', msg, result.lastInsertRowid.toString(), username)
    })
  
    if (!socket.recovered) { // <- recuperase los mensajes sin conexión
      try {
        const results = await db.execute({
          sql: 'SELECT id, content, user FROM messagess WHERE id > ?',
          args: [socket.handshake.auth.serverOffset ?? 0]
        })
  
        results.rows.forEach(row => {
          socket.emit('chat message', row.content, row.id.toString(), row.user)
        })
      } catch (e) {
        console.error(e)
      }
    }
  })
  
  app.use(logger('dev'))
  
  app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/client/index.html')
  })
  
  server.listen(port, () => {
    console.log(`Server running on port ${port}`)
  })