import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  User,
  UserRole,
  UserStatus,
  Message,
  Conversation,
  BroadcastAnnouncement,
  AuditLog,
  SystemStats,
  PaginatedResult,
} from './src/types/index.ts';

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// ==========================================
// In-Memory Scalable DB & RBAC State Engine
// ==========================================

const SUPER_ADMIN_ID = 'saifur-super-admin-01';

const initialUsers: User[] = [
  {
    id: SUPER_ADMIN_ID,
    name: 'KK Gaming Live',
    phone: '+1 (555) 019-2834',
    email: 'saifurrahman03145155799@gmail.com',
    avatar: '/kk_gaming_logo.jpg',
    role: 'super_admin',
    status: 'active',
    about: '🎮 KK Gaming Live | Creator & System Super Admin. Full Owner privileges.',
    createdAt: '2024-01-01T00:00:00.000Z',
    lastSeen: 'Online',
    isOnline: true,
    isImmutableOwner: true,
  },
  {
    id: 'admin-sarah-02',
    name: 'Sarah Jenkins',
    phone: '+1 (555) 014-9921',
    email: 'sarah.jenkins@guardchat.io',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    role: 'secondary_admin',
    status: 'active',
    about: '🛡️ Secondary Admin | Customer Support Lead',
    createdAt: '2024-02-10T11:20:00.000Z',
    lastSeen: 'Online',
    isOnline: true,
  },
  {
    id: 'admin-marcus-03',
    name: 'Marcus Vance',
    phone: '+1 (555) 018-7712',
    email: 'marcus.v@guardchat.io',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'secondary_admin',
    status: 'active',
    about: '🛡️ Secondary Admin | Technical Operations & Support',
    createdAt: '2024-03-01T08:15:00.000Z',
    lastSeen: '5 mins ago',
    isOnline: true,
  },
  {
    id: 'user-alex-04',
    name: 'Alex Morgan',
    phone: '+1 (555) 012-3456',
    email: 'alex.morgan@example.com',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    role: 'general_user',
    status: 'active',
    about: 'Available | Standard verified user',
    createdAt: '2024-04-12T14:32:00.000Z',
    lastSeen: 'Online',
    isOnline: true,
  },
  {
    id: 'user-priya-05',
    name: 'Priya Sharma',
    phone: '+1 (555) 017-8823',
    email: 'priya.s@example.com',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    role: 'general_user',
    status: 'active',
    about: 'Hey there! I am using AdminGuard WhatsApp.',
    createdAt: '2024-05-18T09:45:00.000Z',
    lastSeen: '12 mins ago',
    isOnline: false,
  },
  {
    id: 'user-david-06',
    name: 'David Chen',
    phone: '+1 (555) 011-4478',
    email: 'david.chen@example.com',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    role: 'general_user',
    status: 'active',
    about: 'In a meeting',
    createdAt: '2024-06-02T16:10:00.000Z',
    lastSeen: '1 hour ago',
    isOnline: false,
  },
];

// Scale database: generate 10,000+ realistic general users indexed in memory
const usersMap = new Map<string, User>();
const usersList: User[] = [];

// Insert initial realistic users
initialUsers.forEach((u) => {
  usersMap.set(u.id, u);
  usersList.push(u);
});

// Seed to 10,500 users to demonstrate massive scale & rapid indexed queries
const firstNames = ['James', 'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'William', 'Sophia', 'Lucas', 'Mia', 'Benjamin', 'Amelia', 'Elijah', 'Harper', 'Mason', 'Evelyn', 'Ethan', 'Abigail', 'Logan', 'Emily'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
const cities = ['New York', 'London', 'Toronto', 'Sydney', 'Singapore', 'Berlin', 'Dubai', 'Tokyo', 'San Francisco', 'Paris'];

console.log('⚡ Indexing database for high-scale enterprise (10,500 active users)...');
for (let i = 7; i <= 10500; i++) {
  const fn = firstNames[i % firstNames.length];
  const ln = lastNames[(i * 3) % lastNames.length];
  const city = cities[i % cities.length];
  const id = `user-gen-${i.toString().padStart(6, '0')}`;
  const phoneSuffix = i.toString().padStart(4, '0');
  const user: User = {
    id,
    name: `${fn} ${ln}`,
    phone: `+1 (555) 02${(i % 90) + 10}-${phoneSuffix}`,
    email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.com`,
    avatar: `https://images.unsplash.com/photo-${1500000000000 + (i % 500)}?w=150&auto=format&fit=crop&q=80`,
    role: 'general_user',
    status: i % 120 === 0 ? 'banned' : 'active',
    about: `AdminGuard User from ${city}`,
    createdAt: new Date(Date.now() - (i * 3600000)).toISOString(),
    lastSeen: i % 3 === 0 ? 'Online' : `${(i % 55) + 1} mins ago`,
    isOnline: i % 3 === 0,
  };
  usersMap.set(id, user);
  usersList.push(user);
}
console.log(`✅ Loaded & indexed ${usersList.length} total users in memory.`);

// Conversations & Messages
const conversationsMap = new Map<string, Conversation>();
const messagesMap = new Map<string, Message[]>(); // convId -> Message[]

// Initial Seed Conversations
const initialConvId1 = `conv-${SUPER_ADMIN_ID}-user-alex-04`;
const initialConvId2 = `conv-admin-sarah-02-user-priya-05`;

conversationsMap.set(initialConvId1, {
  id: initialConvId1,
  participantIds: [SUPER_ADMIN_ID, 'user-alex-04'],
  participants: [usersMap.get(SUPER_ADMIN_ID)!, usersMap.get('user-alex-04')!],
  unreadCount: 0,
  updatedAt: new Date(Date.now() - 15 * 60000).toISOString(),
  isSupportTicket: true,
  lastMessage: {
    id: 'msg-seed-1',
    conversationId: initialConvId1,
    senderId: SUPER_ADMIN_ID,
    senderName: 'KK Gaming Live',
    senderRole: 'super_admin',
    recipientId: 'user-alex-04',
    type: 'text',
    content: 'Welcome to the platform Alex! As Super Admin, I am always here to assist with any questions or account security needs.',
    status: 'read',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
  },
});

messagesMap.set(initialConvId1, [
  {
    id: 'msg-seed-0',
    conversationId: initialConvId1,
    senderId: 'user-alex-04',
    senderName: 'Alex Morgan',
    senderRole: 'general_user',
    recipientId: SUPER_ADMIN_ID,
    type: 'text',
    content: 'Hello Super Admin! I have a question regarding account verification.',
    status: 'read',
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
  },
  {
    id: 'msg-seed-1',
    conversationId: initialConvId1,
    senderId: SUPER_ADMIN_ID,
    senderName: 'KK Gaming Live',
    senderRole: 'super_admin',
    recipientId: 'user-alex-04',
    type: 'text',
    content: 'Welcome to the platform Alex! As Super Admin, I am always here to assist with any questions or account security needs.',
    status: 'read',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
  },
]);

conversationsMap.set(initialConvId2, {
  id: initialConvId2,
  participantIds: ['admin-sarah-02', 'user-priya-05'],
  participants: [usersMap.get('admin-sarah-02')!, usersMap.get('user-priya-05')!],
  unreadCount: 1,
  updatedAt: new Date(Date.now() - 5 * 60000).toISOString(),
  isSupportTicket: true,
  lastMessage: {
    id: 'msg-seed-2',
    conversationId: initialConvId2,
    senderId: 'user-priya-05',
    senderName: 'Priya Sharma',
    senderRole: 'general_user',
    recipientId: 'admin-sarah-02',
    type: 'text',
    content: 'Hi Sarah, can you help me update my notification preferences?',
    status: 'delivered',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
  },
});

messagesMap.set(initialConvId2, [
  {
    id: 'msg-seed-2',
    conversationId: initialConvId2,
    senderId: 'user-priya-05',
    senderName: 'Priya Sharma',
    senderRole: 'general_user',
    recipientId: 'admin-sarah-02',
    type: 'text',
    content: 'Hi Sarah, can you help me update my notification preferences?',
    status: 'delivered',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
  },
]);

// Initial Broadcasts
const broadcasts: BroadcastAnnouncement[] = [
  {
    id: 'bc-01',
    senderId: SUPER_ADMIN_ID,
    senderName: 'KK Gaming Live',
    senderRole: 'super_admin',
    title: '📢 System Architecture & Security Policy Active',
    content: 'Welcome to WhatsApp AdminGuard. General users can message verified support admins directly. Super Admin protections and audit logging are fully operational across all 10,000+ members.',
    priority: 'urgent',
    createdAt: new Date(Date.now() - 120 * 60000).toISOString(),
    recipientCount: 10500,
    readsCount: 9482,
  },
  {
    id: 'bc-02',
    senderId: 'admin-sarah-02',
    senderName: 'Sarah Jenkins',
    senderRole: 'secondary_admin',
    title: 'Support Hours & Media Sharing Guidelines',
    content: 'Our Secondary Admin support team is actively monitoring queries. You can send text, screenshots, voice notes, and documents directly to your assigned admin.',
    priority: 'normal',
    createdAt: new Date(Date.now() - 40 * 60000).toISOString(),
    recipientCount: 10500,
    readsCount: 7820,
  },
];

// Audit Logs for Super Admin oversight
const auditLogs: AuditLog[] = [
  {
    id: 'audit-01',
    actorId: SUPER_ADMIN_ID,
    actorName: 'KK Gaming Live',
    actorRole: 'super_admin',
    action: 'promote_admin',
    targetUserId: 'admin-sarah-02',
    targetUserName: 'Sarah Jenkins',
    details: 'Appointed Sarah Jenkins as Secondary Admin (Support Lead).',
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    status: 'allowed',
  },
  {
    id: 'audit-02',
    actorId: SUPER_ADMIN_ID,
    actorName: 'KK Gaming Live',
    actorRole: 'super_admin',
    action: 'promote_admin',
    targetUserId: 'admin-marcus-03',
    targetUserName: 'Marcus Vance',
    details: 'Appointed Marcus Vance as Secondary Admin (Operations).',
    timestamp: new Date(Date.now() - 12 * 3600000).toISOString(),
    status: 'allowed',
  },
  {
    id: 'audit-03',
    actorId: SUPER_ADMIN_ID,
    actorName: 'KK Gaming Live',
    actorRole: 'super_admin',
    action: 'broadcast_sent',
    details: 'Broadcast announcement sent to 10,500 active platform users.',
    timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
    status: 'allowed',
  },
];

// ==========================================
// Realtime WebSocket Manager
// ==========================================
const clientSockets = new Map<string, Set<WebSocket>>();

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket, req) => {
  let authenticatedUserId: string | null = null;

  ws.on('message', (data: string) => {
    try {
      const payload = JSON.parse(data.toString());

      if (payload.type === 'auth') {
        authenticatedUserId = payload.userId;
        if (authenticatedUserId) {
          if (!clientSockets.has(authenticatedUserId)) {
            clientSockets.set(authenticatedUserId, new Set());
          }
          clientSockets.get(authenticatedUserId)!.add(ws);

          // Update user presence
          const user = usersMap.get(authenticatedUserId);
          if (user) {
            user.isOnline = true;
            user.lastSeen = 'Online';
          }

          ws.send(JSON.stringify({ type: 'auth_success', userId: authenticatedUserId }));
        }
      } else if (payload.type === 'typing') {
        // Relay typing status to recipient
        const { recipientId, isTyping, conversationId } = payload;
        if (recipientId && clientSockets.has(recipientId)) {
          const msg = JSON.stringify({
            type: 'typing',
            senderId: authenticatedUserId,
            conversationId,
            isTyping,
          });
          clientSockets.get(recipientId)?.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) client.send(msg);
          });
        }
      }
    } catch (e) {
      console.error('WebSocket message parsing error:', e);
    }
  });

  ws.on('close', () => {
    if (authenticatedUserId && clientSockets.has(authenticatedUserId)) {
      const set = clientSockets.get(authenticatedUserId)!;
      set.delete(ws);
      if (set.size === 0) {
        clientSockets.delete(authenticatedUserId);
        const user = usersMap.get(authenticatedUserId);
        if (user) {
          user.isOnline = false;
          user.lastSeen = 'Just now';
        }
      }
    }
  });
});

function broadcastToUser(userId: string, data: any) {
  const sockets = clientSockets.get(userId);
  if (sockets) {
    const payload = JSON.stringify(data);
    sockets.forEach((s) => {
      if (s.readyState === WebSocket.OPEN) {
        s.send(payload);
      }
    });
  }
}

function broadcastToAllUsers(data: any) {
  const payload = JSON.stringify(data);
  clientSockets.forEach((sockets) => {
    sockets.forEach((s) => {
      if (s.readyState === WebSocket.OPEN) {
        s.send(payload);
      }
    });
  });
}

// ==========================================
// RBAC Security Helpers & Safeguard Logic
// ==========================================

function getRequester(req: express.Request): User | null {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return null;
  return usersMap.get(userId) || null;
}

// ==========================================
// REST API Endpoints
// ==========================================

// 1. Current Session
app.get('/api/auth/me', (req, res) => {
  const user = getRequester(req) || usersMap.get(SUPER_ADMIN_ID);
  res.json({ user });
});

// Quick Switcher / Login (Supports direct phone, email, or user selection)
app.post('/api/auth/login', (req, res) => {
  const { userId, phone, email } = req.body;
  let user: User | undefined;

  if (userId) {
    user = usersMap.get(userId);
  } else if (email) {
    user = usersList.find((u) => u.email.toLowerCase() === email.toLowerCase());
  } else if (phone) {
    user = usersList.find((u) => u.phone === phone);
  }

  if (!user) {
    return res.status(404).json({ error: 'User not found. Please register or select an existing demo account.' });
  }

  if (user.status === 'banned') {
    return res.status(403).json({ error: 'Your account has been suspended by the administration.' });
  }

  res.json({ success: true, user });
});

// Signup (Default role: general_user)
app.post('/api/auth/signup', (req, res) => {
  const { name, phone, email, about } = req.body;
  if (!name || (!phone && !email)) {
    return res.status(400).json({ error: 'Name and Phone or Email are required.' });
  }

  const newId = `user-reg-${Date.now()}`;
  const newUser: User = {
    id: newId,
    name,
    phone: phone || `+1 (555) ${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`,
    email: email || `${name.toLowerCase().replace(/\s+/g, '')}@example.com`,
    avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
    role: 'general_user', // Enforce automatic general user role
    status: 'active',
    about: about || 'Available',
    createdAt: new Date().toISOString(),
    lastSeen: 'Online',
    isOnline: true,
  };

  usersMap.set(newId, newUser);
  usersList.unshift(newUser);

  res.json({ success: true, user: newUser });
});

// Update Profile (Name, Avatar, About, Phone)
app.post('/api/users/:id/profile', (req, res) => {
  const requester = getRequester(req);
  if (!requester) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const targetId = req.params.id;
  // Users can edit their own profile; Super Admin can edit any profile
  if (requester.id !== targetId && requester.role !== 'super_admin') {
    return res.status(403).json({ error: 'You can only modify your own profile.' });
  }

  const targetUser = usersMap.get(targetId);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const { name, avatar, about, phone } = req.body;
  if (name && typeof name === 'string' && name.trim()) {
    targetUser.name = name.trim();
  }
  if (avatar && typeof avatar === 'string' && avatar.trim()) {
    targetUser.avatar = avatar.trim();
  }
  if (about !== undefined && typeof about === 'string') {
    targetUser.about = about.trim();
  }
  if (phone && typeof phone === 'string' && phone.trim()) {
    targetUser.phone = phone.trim();
  }

  // Update in any active conversations where this user is a participant
  conversationsMap.forEach((conv) => {
    const pIdx = conv.participants.findIndex((p) => p.id === targetUser.id);
    if (pIdx !== -1) {
      conv.participants[pIdx] = { ...targetUser };
    }
  });

  // Broadcast update to all connected clients in real-time
  broadcastToAllUsers({
    type: 'user_updated',
    user: targetUser,
  });

  res.json({ success: true, user: targetUser });
});

// System Stats
app.get('/api/users/stats', (req, res) => {
  let superCount = 0;
  let secCount = 0;
  let genCount = 0;
  let bannedCount = 0;
  let activeNow = 0;

  usersList.forEach((u) => {
    if (u.role === 'super_admin') superCount++;
    else if (u.role === 'secondary_admin') secCount++;
    else genCount++;

    if (u.status === 'banned') bannedCount++;
    if (u.isOnline) activeNow++;
  });

  let totalMsgs = 0;
  messagesMap.forEach((msgs) => {
    totalMsgs += msgs.length;
  });

  const stats: SystemStats = {
    totalUsers: usersList.length,
    activeNow,
    superAdminCount: superCount,
    secondaryAdminCount: secCount,
    generalUsersCount: genCount,
    bannedCount,
    totalMessagesSent: totalMsgs,
    totalBroadcasts: broadcasts.length,
  };

  res.json(stats);
});

// Paginated Users Directory (High Scale Querying: handles 10,000+ users with pagination & search)
app.get('/api/users', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.limit as string) || 20;
  const search = ((req.query.search as string) || '').toLowerCase().trim();
  const roleFilter = (req.query.role as string) || 'all';
  const statusFilter = (req.query.status as string) || 'all';

  const startTime = Date.now();

  let filtered = usersList;

  if (roleFilter !== 'all') {
    filtered = filtered.filter((u) => u.role === roleFilter);
  }

  if (statusFilter !== 'all') {
    filtered = filtered.filter((u) => u.status === statusFilter);
  }

  if (search) {
    filtered = filtered.filter(
      (u) =>
        u.name.toLowerCase().includes(search) ||
        u.phone.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search) ||
        u.id.toLowerCase().includes(search)
    );
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const offset = (page - 1) * pageSize;
  const items = filtered.slice(offset, offset + pageSize);
  const queryDurationMs = Date.now() - startTime;

  const result: PaginatedResult<User> & { queryDurationMs: number } = {
    items,
    total,
    page,
    pageSize,
    totalPages,
    queryDurationMs,
  };

  res.json(result);
});

// List Available Admins (for General Users to contact)
app.get('/api/admins', (req, res) => {
  const admins = usersList.filter(
    (u) => (u.role === 'super_admin' || u.role === 'secondary_admin') && u.status === 'active'
  );
  res.json({ admins });
});

// 2. Role Promotion / Demotion (Rigid Safeguard: Super Admin Only)
app.post('/api/users/:id/role', (req, res) => {
  const requester = getRequester(req);
  if (!requester) {
    return res.status(401).json({ error: 'Unauthorized: missing authentication.' });
  }

  const targetId = req.params.id;
  const { newRole } = req.body; // 'secondary_admin' | 'general_user'
  const targetUser = usersMap.get(targetId);

  if (!targetUser) {
    return res.status(404).json({ error: 'Target user not found.' });
  }

  // CRITICAL SAFEGUARD 1: SUPER ADMIN IMMUTABILITY
  if (targetUser.role === 'super_admin' || targetUser.isImmutableOwner || targetId === SUPER_ADMIN_ID) {
    // Record attempted security breach in audit log
    auditLogs.unshift({
      id: `audit-${Date.now()}`,
      actorId: requester.id,
      actorName: requester.name,
      actorRole: requester.role,
      action: 'attempted_owner_breach',
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      details: `SECURITY VIOLATION BLOCKED: ${requester.name} (${requester.role}) attempted to alter the role of Super Admin ${targetUser.name}.`,
      timestamp: new Date().toISOString(),
      status: 'blocked_by_guard',
    });

    return res.status(403).json({
      error: 'CRITICAL SECURITY BREACH PREVENTED: The Super Admin (Creator / Owner) is immutable and cannot be demoted or modified by ANY user.',
    });
  }

  // CRITICAL SAFEGUARD 2: ONLY SUPER ADMIN CAN PROMOTE/DEMOTE SECONDARY ADMINS
  if (requester.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Access Denied: Only the Super Admin possesses authority to appoint or demote Secondary Admins.',
    });
  }

  if (newRole !== 'secondary_admin' && newRole !== 'general_user') {
    return res.status(400).json({ error: 'Invalid role specified.' });
  }

  const prevRole = targetUser.role;
  targetUser.role = newRole;

  // Add to Audit Log
  const logAction = newRole === 'secondary_admin' ? 'promote_admin' : 'demote_admin';
  const detailText =
    newRole === 'secondary_admin'
      ? `Promoted ${targetUser.name} (${targetUser.email}) to Secondary Admin.`
      : `Demoted ${targetUser.name} (${targetUser.email}) back to General User.`;

  auditLogs.unshift({
    id: `audit-${Date.now()}`,
    actorId: requester.id,
    actorName: requester.name,
    actorRole: requester.role,
    action: logAction,
    targetUserId: targetUser.id,
    targetUserName: targetUser.name,
    details: detailText,
    timestamp: new Date().toISOString(),
    status: 'allowed',
  });

  // Notify target user via WebSocket in real-time
  broadcastToUser(targetUser.id, {
    type: 'role_updated',
    newRole,
    message: `Your role has been updated to ${newRole.replace('_', ' ').toUpperCase()} by Super Admin ${requester.name}.`,
  });

  // Notify all connected clients of directory change
  broadcastToAllUsers({
    type: 'user_updated',
    user: targetUser,
  });

  res.json({
    success: true,
    message: `Successfully changed role of ${targetUser.name} from ${prevRole} to ${newRole}.`,
    user: targetUser,
  });
});

// 3. User Moderation: Kick / Ban / Unban
app.post('/api/users/:id/status', (req, res) => {
  const requester = getRequester(req);
  if (!requester) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const targetId = req.params.id;
  const { status } = req.body as { status: UserStatus };
  const targetUser = usersMap.get(targetId);

  if (!targetUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // CRITICAL SAFEGUARD 1: SUPER ADMIN CAN NEVER BE KICKED OR BANNED
  if (targetUser.role === 'super_admin' || targetUser.isImmutableOwner || targetId === SUPER_ADMIN_ID) {
    auditLogs.unshift({
      id: `audit-${Date.now()}`,
      actorId: requester.id,
      actorName: requester.name,
      actorRole: requester.role,
      action: 'attempted_owner_breach',
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      details: `SECURITY VIOLATION BLOCKED: ${requester.name} (${requester.role}) attempted to kick/ban Super Admin ${targetUser.name}.`,
      timestamp: new Date().toISOString(),
      status: 'blocked_by_guard',
    });

    return res.status(403).json({
      error: 'CRITICAL SECURITY BREACH PREVENTED: The Super Admin cannot be kicked, banned, or muted under any circumstances.',
    });
  }

  // General users cannot ban anyone
  if (requester.role === 'general_user') {
    return res.status(403).json({ error: 'General users do not have moderation permissions.' });
  }

  // Secondary admins cannot ban other secondary admins (Super Admin privilege only)
  if (requester.role === 'secondary_admin' && targetUser.role === 'secondary_admin') {
    return res.status(403).json({
      error: 'Secondary Admins cannot kick or moderate fellow Secondary Admins. Only Super Admin can perform this action.',
    });
  }

  targetUser.status = status;

  auditLogs.unshift({
    id: `audit-${Date.now()}`,
    actorId: requester.id,
    actorName: requester.name,
    actorRole: requester.role,
    action: status === 'banned' ? 'ban_user' : 'unban_user',
    targetUserId: targetUser.id,
    targetUserName: targetUser.name,
    details: `${requester.name} set ${targetUser.name}'s status to ${status}.`,
    timestamp: new Date().toISOString(),
    status: 'allowed',
  });

  if (status === 'banned') {
    broadcastToUser(targetUser.id, {
      type: 'account_suspended',
      message: 'Your account has been suspended by the administrator.',
    });
  }

  broadcastToAllUsers({
    type: 'user_updated',
    user: targetUser,
  });

  res.json({ success: true, user: targetUser });
});

// 4. Conversations List
app.get('/api/conversations', (req, res) => {
  const requester = getRequester(req);
  if (!requester) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const userConversations: Conversation[] = [];
  conversationsMap.forEach((conv) => {
    if (conv.participantIds.includes(requester.id)) {
      // Refresh participant info
      const fullParticipants = conv.participantIds
        .map((pid) => usersMap.get(pid))
        .filter((u): u is User => Boolean(u));
      userConversations.push({
        ...conv,
        participants: fullParticipants,
      });
    }
  });

  // Sort by latest message / update
  userConversations.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  res.json({ conversations: userConversations });
});

// 5. Start Conversation (Enforces General User to Admin Only rule)
app.post('/api/conversations/start', (req, res) => {
  const requester = getRequester(req);
  if (!requester) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const { targetUserId } = req.body;
  const targetUser = usersMap.get(targetUserId);

  if (!targetUser) {
    return res.status(404).json({ error: 'Recipient not found.' });
  }

  // RULE CHECK: General User cannot message another General User
  if (requester.role === 'general_user' && targetUser.role === 'general_user') {
    return res.status(403).json({
      error: 'POLICY ENFORCEMENT: General Users are restricted from contacting other General Users directly. You can only start conversations with verified Admins (Super Admin or Secondary Admins).',
    });
  }

  // Check if conversation already exists between these two
  let existingConv: Conversation | undefined;
  conversationsMap.forEach((conv) => {
    if (
      conv.participantIds.length === 2 &&
      conv.participantIds.includes(requester.id) &&
      conv.participantIds.includes(targetUserId)
    ) {
      existingConv = conv;
    }
  });

  if (existingConv) {
    return res.json({ conversation: existingConv });
  }

  // Create new conversation
  const convId = `conv-${Date.now()}-${requester.id.slice(0, 8)}-${targetUserId.slice(0, 8)}`;
  const newConv: Conversation = {
    id: convId,
    participantIds: [requester.id, targetUserId],
    participants: [requester, targetUser],
    unreadCount: 0,
    updatedAt: new Date().toISOString(),
    isSupportTicket: requester.role === 'general_user' || targetUser.role === 'general_user',
  };

  conversationsMap.set(convId, newConv);
  messagesMap.set(convId, []);

  res.json({ conversation: newConv });
});

// 6. Get Messages for a Conversation (Paginated)
app.get('/api/conversations/:id/messages', (req, res) => {
  const requester = getRequester(req);
  if (!requester) return res.status(401).json({ error: 'Unauthorized.' });

  const convId = req.params.id;
  const conv = conversationsMap.get(convId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found.' });

  if (!conv.participantIds.includes(requester.id)) {
    return res.status(403).json({ error: 'Access denied to this conversation.' });
  }

  const msgs = messagesMap.get(convId) || [];
  res.json({ messages: msgs });
});

// 7. Send Message (Text, Image, Audio, Document)
app.post('/api/messages/send', (req, res) => {
  const requester = getRequester(req);
  if (!requester) return res.status(401).json({ error: 'Unauthorized.' });

  const { conversationId, content, type = 'text', media } = req.body;
  const conv = conversationsMap.get(conversationId);

  if (!conv) return res.status(404).json({ error: 'Conversation not found.' });

  if (!conv.participantIds.includes(requester.id)) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  // Find recipient
  const recipientId = conv.participantIds.find((id) => id !== requester.id) || requester.id;
  const recipient = usersMap.get(recipientId);

  // Policy check
  if (requester.role === 'general_user' && recipient && recipient.role === 'general_user') {
    return res.status(403).json({
      error: 'Policy Violation: General Users cannot communicate with other General Users.',
    });
  }

  const msgId = `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const timestamp = new Date().toISOString();

  const newMessage: Message = {
    id: msgId,
    conversationId,
    senderId: requester.id,
    senderName: requester.name,
    senderRole: requester.role,
    recipientId,
    type,
    content: content || '',
    media,
    status: 'delivered',
    timestamp,
  };

  const msgs = messagesMap.get(conversationId) || [];
  msgs.push(newMessage);
  messagesMap.set(conversationId, msgs);

  conv.lastMessage = newMessage;
  conv.updatedAt = timestamp;
  conv.unreadCount += 1;

  // Realtime push to recipient and sender
  broadcastToUser(recipientId, {
    type: 'new_message',
    message: newMessage,
    conversationId,
  });

  broadcastToUser(requester.id, {
    type: 'message_sent_confirm',
    message: newMessage,
    conversationId,
  });

  res.json({ success: true, message: newMessage });
});

// 8. Mark Messages as Read
app.post('/api/messages/read', (req, res) => {
  const requester = getRequester(req);
  if (!requester) return res.status(401).json({ error: 'Unauthorized.' });

  const { conversationId } = req.body;
  const conv = conversationsMap.get(conversationId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found.' });

  const msgs = messagesMap.get(conversationId) || [];
  let updatedCount = 0;

  msgs.forEach((m) => {
    if (m.recipientId === requester.id && m.status !== 'read') {
      m.status = 'read';
      m.readAt = new Date().toISOString();
      updatedCount++;
    }
  });

  conv.unreadCount = 0;

  // Notify sender of double blue tick
  const otherParticipantId = conv.participantIds.find((id) => id !== requester.id);
  if (otherParticipantId) {
    broadcastToUser(otherParticipantId, {
      type: 'messages_read',
      conversationId,
      readBy: requester.id,
      timestamp: new Date().toISOString(),
    });
  }

  res.json({ success: true, updatedCount });
});

// 9. Broadcast Announcements (Admins Only)
app.post('/api/broadcasts', (req, res) => {
  const requester = getRequester(req);
  if (!requester) return res.status(401).json({ error: 'Unauthorized.' });

  if (requester.role === 'general_user') {
    return res.status(403).json({ error: 'Only Admins can send broadcast announcements.' });
  }

  const { title, content, priority = 'normal' } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required.' });
  }

  const newBroadcast: BroadcastAnnouncement = {
    id: `bc-${Date.now()}`,
    senderId: requester.id,
    senderName: requester.name,
    senderRole: requester.role,
    title,
    content,
    priority,
    createdAt: new Date().toISOString(),
    recipientCount: usersList.length,
    readsCount: 1,
  };

  broadcasts.unshift(newBroadcast);

  auditLogs.unshift({
    id: `audit-${Date.now()}`,
    actorId: requester.id,
    actorName: requester.name,
    actorRole: requester.role,
    action: 'broadcast_sent',
    details: `${requester.name} sent broadcast "${title}" to ${usersList.length} users.`,
    timestamp: new Date().toISOString(),
    status: 'allowed',
  });

  // Push broadcast to all active users via WebSocket
  broadcastToAllUsers({
    type: 'broadcast_received',
    broadcast: newBroadcast,
  });

  res.json({ success: true, broadcast: newBroadcast });
});

app.get('/api/broadcasts', (req, res) => {
  res.json({ broadcasts });
});

// 10. System Audit Logs (Super Admin & Secondary Admin)
app.get('/api/audit-logs', (req, res) => {
  const requester = getRequester(req);
  if (!requester || (requester.role !== 'super_admin' && requester.role !== 'secondary_admin')) {
    return res.status(403).json({ error: 'Restricted to administrative personnel.' });
  }
  res.json({ auditLogs });
});

// Download Source Code ZIP Archive
const sendZipFile = (res: express.Response) => {
  const zipPath = path.resolve('public', 'kk_gaming_project_source.zip');
  if (fs.existsSync(zipPath)) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="kk_gaming_live_project_source.zip"');
    return res.sendFile(zipPath);
  }
  return res.status(404).json({ error: 'Source code ZIP archive not found.' });
};

app.get('/api/download-source', (req, res) => sendZipFile(res));
app.get('/kk_gaming_project_source.zip', (req, res) => sendZipFile(res));

// ==========================================
// Vite Middleware / Static Serve
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 WhatsApp AdminGuard server running at http://0.0.0.0:${PORT}`);
    console.log(`🔒 Super Admin: KK Gaming Live (Immutable Owner Protection Enabled)`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
