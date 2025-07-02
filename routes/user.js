const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const authenticateToken = require("../middleware/auth");
const nodemailer = require('nodemailer');

const otpStore = {};

const transporter = nodemailer.createTransport({
  service: 'gmail', // or your provider (e.g., SendGrid, Outlook)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

router.post('/forgetpassword', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  otpStore[email] = { otp, expiresAt };

  try {
    await transporter.sendMail({
      from: `"SmartChat Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is: ${otp}`,
    });

    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});
router.post('/verifyotp', (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore[email];

  if (!record) {
    return res.status(400).json({ message: 'No OTP requested for this email' });
  }

  if (Date.now() > record.expiresAt) {
    delete otpStore[email];
    return res.status(400).json({ message: 'OTP expired' });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }

  // OTP is valid
  delete otpStore[email];
  res.json({ message: 'OTP verified successfully' });
});

router.post('/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;
  const user = await User.findOne({ email });

  if (!user) return res.status(404).json({ error: 'User not found' });

  user.password = await bcrypt.hash(newPassword, 10); // if using bcrypt
  await user.save();

  res.json({ message: 'Password reset successfully' });
});



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
