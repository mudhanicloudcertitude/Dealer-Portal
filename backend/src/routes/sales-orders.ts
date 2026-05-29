import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { SalesOrderModel } from '../models/SalesOrder';
import { SalesInvoiceModel } from '../models/SalesInvoice';
import { InventoryModel } from '../models/Inventory';

const router = Router();

// ─── GET /api/sales-orders ────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const orders = await SalesOrderModel.find({ user: dbUser._id })
      .populate('customer', 'name email companyName')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch sales orders', details: err.message });
  }
});

// ─── PUT /api/sales-orders/:id/status ────────────────────────────────────────
router.put('/:id/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const order = await SalesOrderModel.findOne({ _id: req.params.id, user: dbUser._id });
    if (!order) return res.status(404).json({ error: 'Sales order not found' });
    if (order.status === 'Cancelled') return res.status(400).json({ error: 'Cancelled orders cannot be updated.' });

    const { status } = req.body;
    if (!['Pending', 'Confirmed', 'Delivered', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Use Pending, Confirmed, Delivered, or Cancelled.' });
    }

    order.status = status;
    order.updatedAt = new Date().toISOString();
    await order.save();
    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update order status', details: err.message });
  }
});

// ─── PUT /api/sales-orders/:id/cancel ────────────────────────────────────────
// Cancel + restore inventory stock
router.put('/:id/cancel', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const order = await SalesOrderModel.findOne({ _id: req.params.id, user: dbUser._id });
    if (!order) return res.status(404).json({ error: 'Sales order not found' });
    if (order.status === 'Cancelled') return res.status(400).json({ error: 'Order is already cancelled.' });
    if (order.status === 'Delivered') return res.status(400).json({ error: 'Delivered orders cannot be cancelled.' });

    order.status = 'Cancelled';
    order.updatedAt = new Date().toISOString();

    // Restore inventory stock (only once via guard flag)
    if (!order.stockRestored) {
      const invItem = await InventoryModel.findById(order.inventoryItem);
      if (invItem) {
        invItem.Stock_On_Hand__c += order.quantity;
        invItem.Last_Audit_Date__c = new Date().toISOString().split('T')[0];
        await invItem.save();
        console.log(`[SALES] ✅ Restored ${order.quantity} units to inventory for product: ${order.productName}`);
      }
      order.stockRestored = true;
    }
    await order.save();

    // Also cancel the linked invoice
    await SalesInvoiceModel.updateOne(
      { salesOrder: order._id },
      { status: 'Cancelled' }
    );

    res.json({ success: true, message: 'Sales order cancelled and inventory restored.', order });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to cancel sales order', details: err.message });
  }
});

export default router;
