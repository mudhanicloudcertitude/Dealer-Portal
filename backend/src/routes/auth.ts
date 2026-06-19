import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { sfDB, cacheDB } from '../db/init';
import { generateToken, verifyToken, authenticateToken, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { createDealerAccount, syncAccountFromSF, syncCasesFromSF } from '../services/salesforce';
import { hydrateMockDataForAccount } from '../db/mockHydrate';


const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user in MongoDB
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // ── Realtime Salesforce Sync on Login ──
    try {
      console.log(`[AUTH] Realtime sync for Salesforce Account: ${user.accountId}`);
      await syncAccountFromSF(user.accountId);
      
      console.log(`[AUTH] Realtime sync for Salesforce Cases: ${user.accountId}`);
      await syncCasesFromSF(user.accountId, user._id);

      console.log(`[AUTH] Realtime sync for Salesforce Products...`);
      const { syncProductsFromSF, syncOrdersFromSF, syncInvoicesFromSF } = await import('../services/salesforce');
      await syncProductsFromSF();

      console.log(`[AUTH] Realtime sync for Salesforce Orders...`);
      await syncOrdersFromSF(user.accountId, user._id);

      console.log(`[AUTH] Realtime sync for Salesforce Invoices...`);
      await syncInvoicesFromSF(user.accountId, user._id).catch(console.error);

      console.log(`[AUTH] Realtime sync for Salesforce Leads...`);
      const { syncLeadsFromSF, syncOpportunitiesFromSF, syncSchemesFromSF } = await import('../services/salesforce');
      await syncLeadsFromSF(user.accountId, user._id).catch(console.error);

      console.log(`[AUTH] Realtime sync for Salesforce Opportunities...`);
      await syncOpportunitiesFromSF(user.accountId, user._id).catch(console.error);

      await syncSchemesFromSF().catch(console.error);
    } catch (syncError: any) {
      console.error(`[AUTH] ⚠️ Realtime Salesforce sync failed (non-fatal, using cache):`, syncError.message);
    }

    // Hydrate mock seed data for local ACC* accounts
    if (user.accountId?.startsWith('ACC')) {
      await hydrateMockDataForAccount(user.accountId, user._id);
    }

    // Get account from Salesforce mock DB
    const account = sfDB.get('accounts').find({ Id: user.accountId }).value();

    const token = generateToken({
      userId: user.id,
      accountId: user.accountId,
      role: user.role,
      email: user.email,
    });

    // Log activity in lowdb cache
    cacheDB.get('activityLog')
      .push({ id: uuidv4(), type: 'login', userId: user.id, timestamp: new Date().toISOString() })
      .write();

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, account },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, dealerName, city, state, phone } = req.body;

    // Check duplicate in MongoDB
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const userId = `USR${uuidv4().slice(0, 5).toUpperCase()}`;

    // ── Create Dealer Account in real Salesforce Org ──
    let salesforceAccountId = '';
    try {
      console.log(`[AUTH] Starting Salesforce Account creation for user: ${userId}`);
      salesforceAccountId = await createDealerAccount({
        name: dealerName,
        phone,
        city,
        state,
        userId, // MongoDB User ID → UserId__c in Salesforce
      });
      console.log(`[AUTH] ✅ Salesforce Account ID obtained: ${salesforceAccountId}`);
    } catch (sfError: any) {
      console.error('[AUTH] ❌ Salesforce Account creation failed (non-fatal, using mock ID):', sfError.message);
      // Portal registration still succeeds — Salesforce is non-blocking for resilience
    }

    // Fallback to mock account ID if real SF creation failed (for resilience during local dev)
    const accountId = salesforceAccountId || `ACC${uuidv4().slice(0, 5).toUpperCase()}`;
    const dealerId = `DLR${uuidv4().slice(0, 5).toUpperCase()}`;
    
    // Create dealer account in Salesforce mock DB to keep local cache working
    const newAccount = {
      Id: accountId,
      Name: dealerName,
      Dealer_ID__c: dealerId,
      RecordType: 'Dealer',
      Credit_Limit__c: 1000000,
      Outstanding_Amount__c: 0,
      Status__c: 'Pending Approval',
      City__c: city,
      State__c: state,
      Email__c: email,
      Phone: phone,
      Tier__c: 'Bronze',
      Join_Date__c: new Date().toISOString().split('T')[0],
    };
    sfDB.get('accounts').push(newAccount).write();

    // ── Save user to MongoDB ──
    console.log(`[AUTH] Saving new user to MongoDB: ${email} (accountId: ${accountId})`);
    const newUser = new User({
      id: userId,
      email: email.toLowerCase().trim(),
      password: bcrypt.hashSync(password, 10),
      accountId,
      role: 'dealer',
      name,
      createdAt: new Date().toISOString(),
    });
    await newUser.save();
    console.log(`[AUTH] ✅ User saved to MongoDB: ${userId}`);

    const normalizedEmail = email.toLowerCase().trim();
    const token = generateToken({ userId, accountId, role: 'dealer', email: normalizedEmail });
    res.status(201).json({
      token,
      user: { id: userId, name, email: normalizedEmail, role: 'dealer', account: newAccount },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Registration failed', details: err.message });
  }
});

// GET /api/auth/me
router.get('/me', async (req: any, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded: any = verifyToken(token);
    const dbUser = await User.findOne({ id: decoded.userId });
    const account = sfDB.get('accounts').find({ Id: decoded.accountId }).value();
    const notifications = cacheDB.get('notifications')
      .filter({ userId: decoded.userId, read: false }).value();
    res.json({
      user: {
        userId: decoded.userId,
        id: decoded.userId,
        name: dbUser?.name || decoded.name,
        email: decoded.email,
        role: decoded.role,
        accountId: decoded.accountId,
      },
      account,
      unreadNotifications: notifications.length,
    });
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
});

// GET /api/auth/notifications
router.get('/notifications', authenticateToken, (req: AuthRequest, res) => {
  const notifications = cacheDB.get('notifications')
    .filter({ userId: req.user.userId })
    .value()
    .slice(-20)
    .reverse();
  res.json(notifications);
});

// PUT /api/auth/notifications/:id/read
router.put('/notifications/:id/read', authenticateToken, (req: AuthRequest, res) => {
  const note = cacheDB.get('notifications').find({ id: req.params.id, userId: req.user.userId }).value();
  if (!note) return res.status(404).json({ error: 'Notification not found' });
  cacheDB.get('notifications').find({ id: req.params.id }).assign({ read: true }).write();
  res.json({ success: true });
});

export default router;
