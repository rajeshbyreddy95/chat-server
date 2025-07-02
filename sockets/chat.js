const Message = require('../models/Message'); // Only require once

const onlineUsers = new Set();
const userSocketMap = new Map(); // userId -> socketId

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('🟢 New client connected:', socket.id);

    // Join user
    socket.on('join', (userId) => {
      socket.userId = userId;
      socket.join(userId);
      onlineUsers.add(userId);
      userSocketMap.set(userId, socket.id);

      console.log(`👤 User ${userId} joined`);
      io.emit('updateOnlineUsers', Array.from(onlineUsers));
    });

    // Send message (personal or group)
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

          for (const member of group.members) {
            const memberId = member._id.toString();
            if (memberId !== message.sender) {
              const memberSocketId = userSocketMap.get(memberId);
              if (memberSocketId) {
                io.to(memberSocketId).emit('receiveMessage', savedMsg);
              }
            }
          }

          // Acknowledge sender
          if (senderSocketId) {
            io.to(senderSocketId).emit('messageSentAck', savedMsg);
          }
        } else {
          // Personal message
          const receiverSocketId = userSocketMap.get(message.receiver);
          if (receiverSocketId) {
            io.to(receiverSocketId).emit('receiveMessage', savedMsg);
            io.to(senderSocketId).emit('delivered', { messageId: savedMsg._id });
          }

          if (senderSocketId) {
            io.to(senderSocketId).emit('messageSentAck', savedMsg);
          }
        }
      } catch (err) {
        console.error('❌ Error sending message:', err);
      }
    });

    // Mark as delivered
    socket.on('delivered', async ({ messageId, receiver }) => {
      try {
        await Message.findByIdAndUpdate(messageId, { isDelivered: true });

        const receiverSocketId = userSocketMap.get(receiver);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('delivered', { messageId });
        }
      } catch (err) {
        console.error('❌ Error in delivered handler:', err);
      }
    });

    // Mark as read
    socket.on('messageRead', async ({ messageId, sender }) => {
      try {
        await Message.findByIdAndUpdate(messageId, { isRead: true });

        const senderSocketId = userSocketMap.get(sender);
        if (senderSocketId) {
          io.to(senderSocketId).emit('read', { messageId });
        }
      } catch (err) {
        console.error('❌ Error in messageRead handler:', err);
      }
    });

    // ✅ Typing indicator (Group or Personal)
    socket.on('typing', async ({ to, from, groupId }) => {
      try {
        if (groupId) {
          const group = await Group.findById(groupId).populate('members');
          if (!group) return;

          for (const member of group.members) {
            const memberId = member._id.toString();
            if (memberId !== from) {
              const memberSocketId = userSocketMap.get(memberId);
              if (memberSocketId) {
                io.to(memberSocketId).emit('typing', { from, groupId });
              }
            }
          }
        } else if (to) {
          const receiverSocketId = userSocketMap.get(to);
          if (receiverSocketId) {
            io.to(receiverSocketId).emit('typing', { from });
          }
        }
      } catch (err) {
        console.error('❌ Error in typing handler:', err);
      }
    });

    // ✅ Stop typing
    socket.on('stopTyping', ({ to, from, groupId }) => {
      if (groupId) {
        Group.findById(groupId).populate('members').then((group) => {
          if (!group) return;

          group.members.forEach((member) => {
            const memberId = member._id.toString();
            if (memberId !== from) {
              const memberSocketId = userSocketMap.get(memberId);
              if (memberSocketId) {
                io.to(memberSocketId).emit('stopTyping', { from, groupId });
              }
            }
          });
        }).catch((err) => {
          console.error('❌ Error in stopTyping (group):', err);
        });
      } else if (to) {
        const receiverSocketId = userSocketMap.get(to);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('stopTyping', { from });
        }
      }
    });

    // Reset unread count
    socket.on('resetUnreadCount', ({ from, to }) => {
      const receiverSocketId = userSocketMap.get(to);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('resetUnreadCount', { from });
      }
    });

    // On disconnect
    socket.on('disconnect', () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        userSocketMap.delete(socket.userId);
        io.emit('updateOnlineUsers', Array.from(onlineUsers));
        console.log(`🔴 User ${socket.userId} disconnected`);
      }
    });
  });
};
