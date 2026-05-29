import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { searchSFInvoices } from '../services/salesforce';

const router = Router();

// GET /api/payments/search?name=...&orderId=...
// Search invoices in Salesforce by customer name and/or order ID
router.get('/search', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, orderId } = req.query as { name?: string; orderId?: string };

    if (!name && !orderId) {
      return res.status(400).json({ error: 'Please provide a customer name or Order ID to search.' });
    }

    const invoices = await searchSFInvoices({
      accountId: req.user.accountId,
      customerName: name || '',
      orderId: orderId || '',
    });

    res.json({ invoices });
  } catch (err: any) {
    res.status(500).json({ error: 'Invoice search failed', details: err.message });
  }
});

// GET /api/payments/:id/download - Download invoice as PDF (fallback returns JSON for HTML generation)
router.get('/:id/download', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // In most cases the frontend generates the HTML receipt.
    // This endpoint returns invoice JSON for server-side rendering fallback.
    const { getSFConnection } = require('../services/salesforce');
    const conn = await getSFConnection();

    const record = await conn.sobject('Dealer_Invoice__c').retrieve(req.params.id);
    if (!record) return res.status(404).json({ error: 'Invoice not found' });

    res.json({ invoice: record });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve invoice for download', details: err.message });
  }
});

export default router;
