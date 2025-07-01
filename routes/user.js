const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const authenticateToken = require("../middleware/auth");
// Get all users the current user has chatted with
router.get('/chatted/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }],
    }).populate('sender receiver');

    const userSet = new Set();

    messages.forEach(msg => {
      if (msg.sender._id.toString() !== userId) {
        userSet.add(JSON.stringify(msg.sender));
      }
      if (msg.receiver._id.toString() !== userId) {
        userSet.add(JSON.stringify(msg.receiver));
      }
    });

    const chattedUsers = Array.from(userSet).map(u => JSON.parse(u));

    res.status(200).json(chattedUsers);
  } catch (err) {
    console.error('Error fetching chatted users:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
router.get('/search', async (req, res) => {
  const { query, userId } = req.query;
  console.log(query, userId);
  
  if (!query || !userId) {
    return res.status(400).json({ error: 'Missing query or userId' });
  }

  try {
    const users = await User.find({
      _id: { $ne: userId },
      username: { $regex: query, $options: 'i' },
    }).select('-password');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const users = await User.find({}, '-password'); // exclude password
    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds)) {
      return res.status(400).json({ error: 'userIds must be an array' });
    }

    const users = await User.find({ _id: { $in: userIds } }).select('_id name');
    res.json(users);
  } catch (err) {
    console.error('Error fetching users in bulk:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get("/chat-users/:userId", async (req, res) => {
  const { userId } = req.params;
console.log(userId);

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid userId" });
  }

  try {
    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }],
    });

    const userIdsSet = new Set();
    messages.forEach((msg) => {
      if (msg.sender && msg.sender.toString() !== userId) {
        userIdsSet.add(msg.sender.toString());
      }
      if (msg.receiver && msg.receiver.toString() !== userId) {
        userIdsSet.add(msg.receiver.toString());
      }
    });

    const userIds = Array.from(userIdsSet);
    const users = await User.find({ _id: { $in: userIds } });

    res.json(users);
  } catch (err) {
    console.error("Error in /chat-users:", err);
    res.status(500).json({ message: "Server error fetching chat users" });
  }
});



module.exports = router;
