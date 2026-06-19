import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { runSync, getSyncStatus } from '../services/syncScheduler';
import { User } from '../models/User';
import { syncCasesFromSF, syncProductsFromSF, syncOrdersFromSF, syncInvoicesFromSF, syncLeadsFromSF, syncOpportunitiesFromSF, syncAccountFromSF, syncInventoryFromSF } from '../services/salesforce';
import { hydrateMockDataForAccount } from '../db/mockHydrate';

const router = Router();

// POST /api/sync/trigger - Manually trigger a sync
router.post('/trigger', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found in local database' });

    const accountId = dbUser.accountId || req.user.accountId;
    const isMock = accountId?.startsWith('ACC');

    if (isMock) {
      await hydrateMockDataForAccount(accountId, dbUser._id);
      const result = runSync();
      return res.json({
        success: true,
        message: 'Mock data synced from local Salesforce cache',
        result,
      });
    }

    await syncAccountFromSF(accountId).catch((err) => {
      console.warn('[SYNC] Salesforce account sync warning:', err.message);
    });

    await syncCasesFromSF(accountId, dbUser._id).catch((err) => {
      console.warn('[SYNC] Salesforce cases sync warning:', err.message);
    });

    await syncProductsFromSF().catch((err) => {
      console.warn('[SYNC] Salesforce products sync warning:', err.message);
    });

    await syncOrdersFromSF(accountId, dbUser._id).catch((err) => {
      console.warn('[SYNC] Salesforce orders sync warning:', err.message);
    });

    await syncInvoicesFromSF(accountId, dbUser._id).catch((err) => {
      console.warn('[SYNC] Salesforce invoices sync warning:', err.message);
    });

    await syncLeadsFromSF(accountId, dbUser._id).catch((err) => {
      console.warn('[SYNC] Salesforce Leads sync warning:', err.message);
    });

    await syncOpportunitiesFromSF(accountId, dbUser._id).catch((err) => {
      console.warn('[SYNC] Salesforce Opportunities sync warning:', err.message);
    });

    await syncInventoryFromSF(accountId, dbUser._id).catch((err) => {
      console.warn('[SYNC] Salesforce Inventory sync warning:', err.message);
    });

    const result = runSync();
    res.json({
      success: true,
      message: 'Data synced successfully from Salesforce',
      result,
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
