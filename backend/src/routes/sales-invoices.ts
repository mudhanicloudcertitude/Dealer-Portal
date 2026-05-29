import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { SalesInvoiceModel } from '../models/SalesInvoice';

const router = Router();

// ─── GET /api/sales-invoices ──────────────────────────────────────────────────
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const invoices = await SalesInvoiceModel.find({ user: dbUser._id })
      .populate('customer', 'name email companyName')
      .populate('salesOrder', 'orderNumber productName quantity')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch sales invoices', details: err.message });
  }
});

// ─── PUT /api/sales-invoices/:id/pay ─────────────────────────────────────────
router.put('/:id/pay', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const invoice = await SalesInvoiceModel.findOne({ _id: req.params.id, user: dbUser._id });
    if (!invoice) return res.status(404).json({ error: 'Sales invoice not found' });
    if (invoice.status === 'Paid') return res.status(400).json({ error: 'Invoice is already paid.' });
    if (invoice.status === 'Cancelled') return res.status(400).json({ error: 'Cancelled invoices cannot be paid.' });

    const { paymentRef } = req.body;
    invoice.status = 'Paid';
    invoice.paidDate = new Date().toISOString().split('T')[0];
    invoice.paymentRef = paymentRef || '';
    await invoice.save();
    res.json({ success: true, invoice });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mark invoice as paid', details: err.message });
  }
});

// ─── PUT /api/sales-invoices/:id/status ──────────────────────────────────────
router.put('/:id/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const invoice = await SalesInvoiceModel.findOne({ _id: req.params.id, user: dbUser._id });
    if (!invoice) return res.status(404).json({ error: 'Sales invoice not found' });
    if (invoice.status === 'Paid') return res.status(400).json({ error: 'Paid invoices cannot be modified.' });

    const { status } = req.body;
    if (!['Pending', 'Overdue', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    invoice.status = status;
    await invoice.save();
    res.json(invoice);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update invoice status', details: err.message });
  }
});

export default router;
