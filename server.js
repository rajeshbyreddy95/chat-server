require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const msgRoutes = require('./routes/messages');

// Config
const connectDB = require('./config/db');
const chatSocketHandler = require('./sockets/chat');

// Express App & Server
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*', // ✅ Adjust this in production to match your frontend origin
    methods: ['GET', 'POST', 'PATCH']
  }
});

// Database Connection
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());

// ✅ Attach io BEFORE the routes so `req.io` works inside them
app.use((req, res, next) => {
  req.io = io;
  next();
});

// API Routes
app.use('/user', authRoutes);
app.use('/users', userRoutes);
app.use('/messages', msgRoutes);

// Socket.IO Events
chatSocketHandler(io);

// Server Listen
const PORT = process.env.PORT || 6060;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
