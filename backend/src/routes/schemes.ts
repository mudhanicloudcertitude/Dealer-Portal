import { Router } from 'express';
import { sfDB } from '../db/init';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { syncSchemesFromSF } from '../services/salesforce';

const router = Router();

// GET /api/schemes - All active schemes for the dealer
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Live-sync active schemes from Salesforce
    await syncSchemesFromSF().catch((err) => {
      console.warn('[SCHEMES ROUTE] Salesforce scheme sync warning:', err.message);
    });

    const account = sfDB.get('accounts').find({ Id: req.user.accountId }).value();
    const today = new Date().toISOString().split('T')[0];
    const schemes = sfDB.get('dealerSchemes').filter((s: any) => {
      if (!s.IsActive__c) return false;
      if (s.End_Date__c && s.End_Date__c < today) return false;
      return true;
    }).value();
    res.json(schemes);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch schemes', details: err.message });
  }
});

// POST /api/schemes/calculate - Calculate discount for a given order value
router.post('/calculate', authenticateToken, (req: AuthRequest, res) => {
  const { orderValue, schemeId } = req.body;
  const scheme = sfDB.get('dealerSchemes').find({ Id: schemeId, IsActive__c: true }).value();
  if (!scheme) return res.status(404).json({ error: 'Scheme not found or inactive' });
  if (orderValue < scheme.Min_Order_Value__c || orderValue > scheme.Max_Order_Value__c) {
    return res.json({ eligible: false, message: `Order must be between ₹${scheme.Min_Order_Value__c.toLocaleString()} and ₹${scheme.Max_Order_Value__c.toLocaleString()}` });
  }
  const discount = orderValue * (scheme.Discount_Percentage__c / 100);
  res.json({ eligible: true, discount, finalAmount: orderValue - discount, scheme });
});

export default router;
