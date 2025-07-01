const dotenv = require('dotenv');
dotenv.config()
const express = require("express")
const mongoose = require("mongoose")
const http = require('http');
const socketIo = require('socket.io');
const chatSocketHandler = require('./sockets/chat');

const cors = require('cors');
const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/user')
const msgRoutes = require('./routes/messages')
const connectDB = require('./config/db');

const app = express()
app.use(cors());
app.use(express.json());
connectDB()
const port = process.env.PORT||6060
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*', // Adjust for production
  },
});



app.use('/user', authRoutes);
app.use('/users', userRoutes)
app.use('/messages', msgRoutes)
chatSocketHandler(io);
app.use((req, res, next) => {
  req.io = io; // 👈 Attach io to req
  next();
});

server.listen(port, ()=>{
    console.log('server running under port ', port);
    
})