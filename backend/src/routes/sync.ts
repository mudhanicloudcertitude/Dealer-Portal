import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { runSync, getSyncStatus } from '../services/syncScheduler';
import { User } from '../models/User';
import { syncCasesFromSF, syncProductsFromSF, syncOrdersFromSF, syncInvoicesFromSF, syncLeadsFromSF, syncOpportunitiesFromSF } from '../services/salesforce';

const router = Router();

// POST /api/sync/trigger - Manually trigger a sync
router.post('/trigger', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found in local database' });

    console.log(`[SYNC] Triggering real-time Salesforce Cases sync for User: ${dbUser.email}...`);
    await syncCasesFromSF(dbUser.accountId, dbUser._id);

    console.log(`[SYNC] Triggering real-time Salesforce Products sync...`);
    await syncProductsFromSF();

    console.log(`[SYNC] Triggering real-time Salesforce Orders sync for Account: ${dbUser.accountId}...`);
    await syncOrdersFromSF(dbUser.accountId, dbUser._id);

    console.log(`[SYNC] Triggering real-time Salesforce Invoices sync for Account: ${dbUser.accountId}...`);
    await syncInvoicesFromSF(dbUser.accountId, dbUser._id).catch((err) => {
      console.warn('[SYNC] Salesforce invoices sync warning:', err.message);
    });

    console.log(`[SYNC] Triggering real-time Salesforce Leads sync for Account: ${dbUser.accountId}...`);
    await syncLeadsFromSF(dbUser.accountId, dbUser._id).catch((err) => {
      console.warn('[SYNC] Salesforce Leads sync warning:', err.message);
    });

    console.log(`[SYNC] Triggering real-time Salesforce Opportunities sync for Account: ${dbUser.accountId}...`);
    await syncOpportunitiesFromSF(dbUser.accountId, dbUser._id).catch((err) => {
      console.warn('[SYNC] Salesforce Opportunities sync warning:', err.message);
    });

    const result = runSync();
    res.json({
      success: true,
      message: 'Cases, Products, Orders, and Invoices synced successfully from Salesforce',
      result
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Sync failed', details: err.message });
  }
});

// GET /api/sync/status - Get sync status and logs
router.get('/status', authenticateToken, (req, res) => {
  res.json(getSyncStatus());
});

export default router;
