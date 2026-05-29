import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { CaseModel } from '../models/Case';
import { LeadModel } from '../models/Lead';
import { OpportunityModel } from '../models/Opportunity';
import { sfDB } from '../db/init';

const router = Router();

// GET /api/dashboard - Dealer overview: Leads, Opportunities, Cases
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const accountId = req.user.accountId;
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found in local database' });

    // Load account metadata
    const account = sfDB.get('accounts').find({ Id: accountId }).value();

    // Load Leads from MongoDB (synced from SF)
    let leads: any[] = [];
    try {
      const rawLeads = await LeadModel.find({ user: dbUser._id }).sort({ createdAt: -1 }).lean();
      leads = rawLeads.map(l => ({
        Id: (l as any).sfId || (l as any)._id.toString(),
        contactName: (l as any).contactName || ((l as any).FirstName + ' ' + (l as any).LastName),
        company: (l as any).company || '',
        Status: (l as any).status || 'Open - Not Contacted',
        email: (l as any).email || '',
        phone: (l as any).phone || '',
        CreatedDate: (l as any).createdAt || '',
      }));
    } catch (e) {
      console.warn('[DASHBOARD] Could not load Leads:', (e as any).message);
    }

    // Load Opportunities from MongoDB (synced from SF)
    let opportunities: any[] = [];
    try {
      const rawOpps = await OpportunityModel.find({ user: dbUser._id }).sort({ createdAt: -1 }).lean();
      opportunities = rawOpps.map(o => ({
        Id: (o as any).sfId || (o as any)._id.toString(),
        Name: (o as any).name || (o as any).Name || 'Unnamed Deal',
        StageName: (o as any).stage || (o as any).StageName || 'Prospecting',
        Amount: (o as any).amount || (o as any).Amount || 0,
        CloseDate: (o as any).closeDate || (o as any).CloseDate || '',
        Probability: (o as any).probability || 0,
      }));
    } catch (e) {
      console.warn('[DASHBOARD] Could not load Opportunities:', (e as any).message);
    }

    // Load Cases from MongoDB
    let cases: any[] = [];
    try {
      const rawCases = await CaseModel.find({ user: dbUser._id, accountId }).sort({ CreatedDate: -1 }).lean();
      cases = rawCases.map(c => ({
        Id: (c as any).sfId || (c as any)._id.toString(),
        CaseNumber: c.CaseNumber,
        Subject: c.Subject,
        Status: c.Status,
        Priority: c.Priority,
        CreatedDate: c.CreatedDate,
        CustomerName: (c as any).CustomerName || null,
      }));
    } catch (e) {
      console.warn('[DASHBOARD] Could not load Cases:', (e as any).message);
    }

    res.json({
      account,
      leads,
      opportunities,
      cases,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate dashboard data', details: err.message });
  }
});

export default router;
