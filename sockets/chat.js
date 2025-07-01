const Message = require('../models/Message');
const User = require('../models/User');

const userSocketMap = new Map(); // username -> socketId

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // User joins
    socket.on('join', async (username) => {
      socket.username = username;
      socket.join(username);
      userSocketMap.set(username, socket.id);
      console.log(`User ${username} joined`);
    });

    // Send message (group or private)
    socket.on('sendMessage', async (message) => {
      try {
        const savedMsg = await Message.create({
          ...message,
          isDelivered: false,
          isRead: false,
        });

        const senderSocketId = userSocketMap.get(message.sender);

        if (message.isGroup && message.groupId) {
          const group = await Group.findById(message.groupId).populate('members');
          if (!group) return;

          group.members.forEach((member) => {
            const memberId = member._id.toString();
            if (memberId !== message.sender) {
              const memberSocketId = userSocketMap.get(member.username);
              if (memberSocketId) {
                io.to(memberSocketId).emit('receiveMessage', { ...savedMsg._doc, tempId: message.tempId });
                io.to(senderSocketId).emit('delivered', { messageId: savedMsg._id, tempId: message.tempId });
              }
            }
          });

          if (senderSocketId) {
            io.to(senderSocketId).emit('messageSentAck', { ...savedMsg._doc, tempId: message.tempId });
          }
        } else {
          const receiverSocketId = userSocketMap.get(message.receiver);
          if (receiverSocketId) {
            io.to(receiverSocketId).emit('receiveMessage', { ...savedMsg._doc, tempId: message.tempId });
            io.to(senderSocketId).emit('delivered', { messageId: savedMsg._id, tempId: message.tempId });
          }

          if (senderSocketId) {
            io.to(senderSocketId).emit('messageSentAck', { ...savedMsg._doc, tempId: message.tempId });
          }
        }
      } catch (err) {
        console.error('Error sending message:', err);
      }
    });

    // Message delivered
    socket.on('delivered', async ({ messageId, receiver }) => {
      try {
        await Message.findByIdAndUpdate(messageId, { isDelivered: true });
        const receiverSocketId = userSocketMap.get(receiver);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('delivered', { messageId });
        }
      } catch (err) {
        console.error('Error in delivered handler:', err);
      }
    });

    // Message read
    socket.on('messageRead', async ({ messageId, sender }) => {
      try {
        await Message.findByIdAndUpdate(messageId, { isRead: true });
        const senderSocketId = userSocketMap.get(sender);
        if (senderSocketId) {
          io.to(senderSocketId).emit('read', { messageId });
        }
      } catch (err) {
        console.error('Error in messageRead handler:', err);
      }
    });

    // Typing indicator
    socket.on('typing', ({ to, from, groupId }) => {
      if (groupId) {
        Group.findById(groupId).then((group) => {
          group.members.forEach((member) => {
            const memberId = member._id.toString();
            if (memberId !== from) {
              const memberSocketId = userSocketMap.get(member.username);
              if (memberSocketId) {
                io.to(memberSocketId).emit('typing', { from, groupId });
              }
            }
          });
        });
      } else {
        const receiverSocketId = userSocketMap.get(to);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('typing', { from });
        }
      }
    });

    // Stop typing
    socket.on('stopTyping', ({ to, from }) => {
      const receiverSocketId = userSocketMap.get(to);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('stopTyping', { from });
      }
    });

    // Reset unread count
    socket.on('resetUnreadCount', ({ from, to }) => {
      const receiverSocketId = userSocketMap.get(to);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('resetUnreadCount', { from });
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      if (socket.username) {
        userSocketMap.delete(socket.username);
        console.log(`User ${socket.username} disconnected`);
      }
    });
  });
};