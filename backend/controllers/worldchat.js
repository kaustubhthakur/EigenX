const worldChat = require("../models/WorldChat");
const duelModel = require("../models/Duel"); 

const MESSAGE_COOLDOWN_MS = 1000;
const lastMessageAt = new Map(); 


const toId = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const emitToWorld = (req, event, payload) => {
  const io = req.app.get("io");
  if (io) io.to("world").emit(event, payload);
};

const emitToUser = (req, userId, event, payload) => {
  const io = req.app.get("io");
  if (io) io.to(`user:${userId}`).emit(event, payload);
};


// World duels use a real configuration (level + timer), set in WORLD_DUEL_CONFIG.
const createWorldDuel = async ({ senderId, receiverId }) => {
  const { level, timer } = worldChat.WORLD_DUEL_CONFIG;
  const configurationId = await duelModel.findConfigurationId(level, timer);

  if (!configurationId) {
    throw new Error(`No game configuration found for level ${level} at ${timer}s`);
  }

  const duel = await duelModel.createDuel(senderId, receiverId, configurationId);
  return duel.id;
};



exports.getMessages = async (req, res) => {
  try {
    const messages = await worldChat.getRecentMessages({
      limit: req.query.limit,
      beforeId: toId(req.query.beforeId),
    });

    res.json({ messages });
  } catch (err) {
    console.error("getMessages error:", err);
    res.status(500).json({ message: "Could not load messages" });
  }
};

exports.postMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";

    if (!content) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }
    if (content.length > 500) {
      return res.status(400).json({ message: "Message is too long (500 characters max)" });
    }

    const now = Date.now();
    if (now - (lastMessageAt.get(userId) || 0) < MESSAGE_COOLDOWN_MS) {
      return res.status(429).json({ message: "You are sending messages too fast" });
    }
    lastMessageAt.set(userId, now);

    const message = await worldChat.sendMessage({ userId, content });
    if (!message) {
      return res.status(400).json({ message: "Message could not be sent" });
    }

    emitToWorld(req, "world:message", message);
    res.status(201).json({ message });
  } catch (err) {
    console.error("postMessage error:", err);
    res.status(500).json({ message: "Could not send message" });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const messageId = toId(req.params.id);
    if (!messageId) {
      return res.status(400).json({ message: "Invalid message id" });
    }

    const deleted = await worldChat.deleteOwnMessage({
      messageId,
      userId: req.user.id,
    });
    if (!deleted) {
      return res.status(404).json({ message: "Message not found" });
    }

    emitToWorld(req, "world:message-deleted", { id: deleted.id });
    res.json({ id: deleted.id });
  } catch (err) {
    console.error("deleteMessage error:", err);
    res.status(500).json({ message: "Could not delete message" });
  }
};



exports.getOnlineUsers = async (req, res) => {
  try {
    const users = await worldChat.getOnlineUsers(req.query.limit);
    res.json({ users });
  } catch (err) {
    console.error("getOnlineUsers error:", err);
    res.status(500).json({ message: "Could not load online users" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = toId(req.params.id);
    if (!userId) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const profile = await worldChat.getWorldProfile(userId);
    if (!profile) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ profile });
  } catch (err) {
    console.error("getProfile error:", err);
    res.status(500).json({ message: "Could not load profile" });
  }
};



exports.sendDuelRequest = async (req, res) => {
  try {
    const senderId = req.user.id;
    const receiverId = toId(req.body.receiverId);

    if (!receiverId) {
      return res.status(400).json({ message: "Invalid user" });
    }
    if (receiverId === senderId) {
      return res.status(400).json({ message: "You cannot challenge yourself" });
    }

    const request = await worldChat.createDuelRequest({ senderId, receiverId });

    if (!request) {
      const target = await worldChat.getWorldProfile(receiverId);
      if (!target) {
        return res.status(404).json({ message: "User not found" });
      }
      return res.status(409).json({ message: `${target.username} is offline right now` });
    }

    const full = await worldChat.getRequestById(request.id);
    emitToUser(req, receiverId, "world:duel-request", full);
    res.status(201).json({ request: full });
  } catch (err) {
    if (err.code === "REQUEST_ALREADY_PENDING") {
      return res.status(409).json({ message: "A duel request is already pending with this player" });
    }
    console.error("sendDuelRequest error:", err);
    res.status(500).json({ message: "Could not send duel request" });
  }
};

exports.getIncoming = async (req, res) => {
  try {
    const requests = await worldChat.getIncomingRequests(req.user.id);
    res.json({ requests });
  } catch (err) {
    console.error("getIncoming error:", err);
    res.status(500).json({ message: "Could not load requests" });
  }
};

exports.getOutgoing = async (req, res) => {
  try {
    const requests = await worldChat.getOutgoingRequests(req.user.id);
    res.json({ requests });
  } catch (err) {
    console.error("getOutgoing error:", err);
    res.status(500).json({ message: "Could not load requests" });
  }
};


const explainUnavailable = async (res, requestId) => {
  const existing = await worldChat.getRequestById(requestId);

  if (!existing) {
    return res.status(404).json({ message: "Request not found" });
  }
  if (existing.status === "expired" || (existing.status === "pending" && new Date(existing.expires_at) <= new Date())) {
    return res.status(410).json({ message: "This duel request has expired" });
  }
  return res.status(409).json({ message: `This request was already ${existing.status}` });
};

exports.acceptDuelRequest = async (req, res) => {
  try {
    const requestId = toId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ message: "Invalid request id" });
    }

    const accepted = await worldChat.respondToRequest({
      requestId,
      receiverId: req.user.id,
      accept: true,
    });
    if (!accepted) {
      return explainUnavailable(res, requestId);
    }

    let duelId;
    try {
      duelId = await createWorldDuel({
        senderId: accepted.sender_id,
        receiverId: accepted.receiver_id,
      });
    } catch (err) {
      // Don't leave the request stuck as "accepted" with no duel behind it.
      await worldChat.revertAcceptedRequest({ requestId }).catch(() => {});
      throw err;
    }
    await worldChat.attachDuel({ requestId, duelId });

    const payload = { requestId, duelId };
    emitToUser(req, accepted.sender_id, "world:duel-start", payload);
    emitToUser(req, accepted.receiver_id, "world:duel-start", payload);

    res.json(payload);
  } catch (err) {
    console.error("acceptDuelRequest error:", err);
    res.status(500).json({ message: "Could not start the duel" });
  }
};

exports.declineDuelRequest = async (req, res) => {
  try {
    const requestId = toId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ message: "Invalid request id" });
    }

    const declined = await worldChat.respondToRequest({
      requestId,
      receiverId: req.user.id,
      accept: false,
    });
    if (!declined) {
      return explainUnavailable(res, requestId);
    }

    emitToUser(req, declined.sender_id, "world:duel-declined", { requestId });
    res.json({ requestId, status: declined.status });
  } catch (err) {
    console.error("declineDuelRequest error:", err);
    res.status(500).json({ message: "Could not decline request" });
  }
};

exports.cancelDuelRequest = async (req, res) => {
  try {
    const requestId = toId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ message: "Invalid request id" });
    }

    const cancelled = await worldChat.cancelRequest({
      requestId,
      senderId: req.user.id,
    });
    if (!cancelled) {
      return explainUnavailable(res, requestId);
    }

    emitToUser(req, cancelled.receiver_id, "world:duel-cancelled", { requestId });
    res.json({ requestId, status: cancelled.status });
  } catch (err) {
    console.error("cancelDuelRequest error:", err);
    res.status(500).json({ message: "Could not cancel request" });
  }
};