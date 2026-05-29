import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { CustomerModel } from '../models/Customer';
import { SalesOrderModel } from '../models/SalesOrder';
import { SalesInvoiceModel } from '../models/SalesInvoice';

const router = Router();

// ─── GET /api/customers ───────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const customers = await CustomerModel.find({ user: dbUser._id })
      .populate('opportunity', 'title stage')
      .sort({ createdAt: -1 });

    // Attach order count and total revenue
    const enriched = await Promise.all(customers.map(async (c) => {
      const orders = await SalesOrderModel.find({ customer: c._id });
      const invoices = await SalesInvoiceModel.find({ customer: c._id });
      const totalRevenue = invoices.filter(i => i.status === 'Paid').reduce((sum, i) => sum + i.amount, 0);
      return {
        ...c.toObject(),
        totalOrders: orders.length,
        totalRevenue,
        invoicesPending: invoices.filter(i => i.status === 'Pending').length,
      };
    }));

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch customers', details: err.message });
  }
});

// ─── GET /api/customers/:id ───────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const customer = await CustomerModel.findOne({ _id: req.params.id, user: dbUser._id });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const salesOrders = await SalesOrderModel.find({ customer: customer._id }).sort({ createdAt: -1 });
    const salesInvoices = await SalesInvoiceModel.find({ customer: customer._id }).sort({ createdAt: -1 });

    res.json({ customer, salesOrders, salesInvoices });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch customer details', details: err.message });
  }
});

// ─── PUT /api/customers/:id ───────────────────────────────────────────────────
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const customer = await CustomerModel.findOne({ _id: req.params.id, user: dbUser._id });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const { name, phone, companyName } = req.body;
    if (name) customer.name = name;
    if (phone) customer.phone = phone;
    if (companyName) customer.companyName = companyName;
    // Email is not editable — it's the unique key
    await customer.save();
    res.json(customer);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update customer', details: err.message });
  }
});

export default router;
