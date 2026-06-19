import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { LeadModel } from '../models/Lead';
import { createSFLead, syncLeadsFromSF } from '../services/salesforce';

const router = Router();

// ─── GET /api/leads ───────────────────────────────────────────────────────────
// Returns leads for the current dealer, synced from Salesforce (Dealer__c = accountId)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    // Sync from Salesforce first (real account), then return
    const leads = await syncLeadsFromSF(req.user.accountId, dbUser._id);
    res.json(leads);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch leads', details: err.message });
  }
});

// ─── POST /api/leads ──────────────────────────────────────────────────────────
// Creates a Lead in Salesforce with Source = 'Dealer Portal' and Dealer__c lookup
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const { contactName, phone, email, companyName, notes } = req.body;

    if (!contactName || !phone || !companyName) {
      return res.status(400).json({ error: 'Customer name, phone, and company name are required.' });
    }

    // Source is ALWAYS 'Dealer Portal' — not configurable by the dealer
    const SOURCE = 'Dealer Portal';

    // 1. Submit Lead to Salesforce live with Dealer__c lookup
    const sfId = await createSFLead({
      sfAccountId: req.user.accountId,
      contactName,
      phone,
      email: email || '',
      companyName: companyName || '',
      source: SOURCE,
      notes: notes || '',
    });

    // 2. Cache in local MongoDB
    const lead = new LeadModel({
      user: dbUser._id,
      sfId,
      contactName,
      phone,
      email: email || '',
      companyName: companyName || '',
      source: SOURCE,
      notes: notes || '',
      status: 'Open - Not Contacted',
      convertedToOpportunity: false,
    });
    await lead.save();

    res.status(201).json(lead);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create lead', details: err.message });
  }
});

export default router;
