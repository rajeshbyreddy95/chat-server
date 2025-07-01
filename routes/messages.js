// server/routes/messageRoutes.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");
const jwt = require('jsonwebtoken');


// Existing routes (unchanged)
router.get("/chat-users/:userId", async (req, res) => {
  const { userId } = req.params;
  console.log("current ", userId);

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

router.get("/unread-count/:userId", async (req, res) => {
  const userId = req.params.userId;
  console.log("Fetching unread counts for userId:", userId);
  try {
    const unread = await Message.aggregate([
      {
        $match: {
          receiver: new mongoose.Types.ObjectId(userId),
          isRead: false,
        },
      },
      {
        $group: {
          _id: "$sender",
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "senderInfo",
        },
      },
      {
        $unwind: "$senderInfo",
      },
      {
        $project: {
          count: 1,
          senderUsername: "$senderInfo.username",
        },
      },
    ]);
    console.log("Unread counts result:", unread);
    res.json(unread);
  } catch (err) {
    console.error("Unread count error:", err.message);
    res.status(500).json({ error: "Server error fetching unread counts" });
  }
});
router.patch("/mark-read", async (req, res) => {
  const { senderUsername, receiverUsername } = req.body;

  try {
    const sender = await User.findOne({ username: senderUsername });
    const receiver = await User.findOne({ username: receiverUsername });

    if (!sender || !receiver) {
      return res.status(404).json({ error: "Sender or receiver not found" });
    }

    await Message.updateMany(
      {
        sender: sender._id,
        receiver: receiver._id,
        isRead: false,
      },
      { $set: { isRead: true, isDelivered: true } }
    );

    res.sendStatus(200);
  } catch (err) {
    console.error("Error marking messages as read:", err);
    res.status(500).json({ error: "Failed to mark messages as read" });
  }
});


router.get("/:senderId/:receiverId", async (req, res) => {
  const { senderId, receiverId } = req.params;

  console.log("heyyy ",senderId, receiverId);
  
  if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
    return res.status(400).json({ error: "Invalid sender or receiver ID" });
  }

  try {
    const messages = await Message.find({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId },
      ],
    })
      .sort({ timestamp: 1 })
      .populate("sender", "username name")
      .populate("receiver", "username name");

    res.json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err.message);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});



router.post("/send", async (req, res) => {
  const { sender, receiver, content, tempId, senderName, timestamp } = req.body;

  if (!sender || !receiver || !content) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const message = new Message({
      sender,
      receiver,
      content,
      tempId,
      senderName,
      timestamp: timestamp || new Date(),
      isDelivered: true,
      isRead: false,
    });

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "username name")
      .populate("receiver", "username name");

    req.io.to(sender).emit("delivered", { messageId: message._id });
    req.io.to(receiver).emit("receiveMessage", populatedMessage);

    res.json(populatedMessage);
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.get("/messages/group/:groupId", async (req, res) => {
  const { groupId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    return res.status(400).json({ error: "Invalid group ID" });
  }

  try {
    const messages = await Message.find({
      groupId,
      isGroup: true,
    })
      .sort({ timestamp: 1 })
      .populate("sender", "username name");
    res.json(messages);
  } catch (err) {
    console.error("Error fetching group messages:", err.message);
    res.status(500).json({ error: "Failed to fetch group messages" });
  }
});

module.exports = router;