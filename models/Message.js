const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: String,
  timestamp: { type: Date, default: Date.now },
  isDelivered: { type: Boolean, default: false },
  isRead: { type: Boolean, default: false }, // ✅ Add this
});

module.exports = mongoose.model('Message', messageSchema);
