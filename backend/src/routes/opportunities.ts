import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { syncOpportunitiesFromSF } from '../services/salesforce';

const router = Router();

// ─── GET /api/opportunities ───────────────────────────────────────────────────
// Read-only: syncs from Salesforce where Dealer_Account__c = dealer's account ID
// No create, edit, stage change, won/lost, or delete allowed from portal
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const opportunities = await syncOpportunitiesFromSF(req.user.accountId, dbUser._id);

    // Return with consistent field names for the frontend
    const mapped = opportunities.map((o: any) => ({
      _id: o._id?.toString() || o.sfId,
      sfId: o.sfId,
      Name: o.name || o.title || o.Name,
      title: o.name || o.title || o.Name,
      StageName: o.stage || o.StageName,
      stage: o.stage || o.StageName,
      Amount: o.expectedValue || o.Amount || 0,
      expectedValue: o.expectedValue || o.Amount || 0,
      CloseDate: o.expectedCloseDate || o.CloseDate,
      expectedCloseDate: o.expectedCloseDate || o.CloseDate,
      probability: o.probability || 0,
      contactName: o.contactName,
      companyName: o.companyName,
      productName: o.productName,
      quantity: o.quantity,
      notes: o.notes,
      wonAt: o.wonAt,
      lostReason: o.lostReason,
    }));

    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch deals', details: err.message });
  }
});

export default router;
