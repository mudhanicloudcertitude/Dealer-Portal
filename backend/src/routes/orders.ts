import mongoose from 'mongoose';
import { Router } from 'express';
import { sfDB } from '../db/init';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { ProductModel } from '../models/Product';
import { OrderModel } from '../models/Order';
import { createSFOrder, syncOrdersFromSF } from '../services/salesforce';

const router = Router();

// ─── GET /api/orders ─────────────────────────────────────────────────────────
// Returns all orders for the current dealer. Syncs from Salesforce first.
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    // Try to sync from SF first, then fall back to local
    try {
      await syncOrdersFromSF(req.user.accountId, dbUser._id);
    } catch (e: any) {
      console.warn('[ORDERS] SF sync skipped:', e.message);
    }

    const orders = await OrderModel.find({ user: dbUser._id }).sort({ CreatedDate: -1 });

    const mapped = orders.map((o: any) => ({
      Id: o.sfId || o._id.toString(),
      sfId: o.sfId,
      OrderNumber: o.OrderNumber,
      Status: o.Status,
      TotalAmount: o.TotalAmount,
      EffectiveDate: o.CreatedDate,
      DeliveryDate__c: o.DeliveryDate,
      Tracking_Number__c: o.TrackingNumber,
      ShippingCity: o.ShippingCity,
      CustomerName: [o.CustomerFirstName, o.CustomerLastName].filter(Boolean).join(' ') || null,
      CustomerEmail: o.CustomerEmail || null,
      CustomerPhone: o.CustomerPhone || null,
      items: [{
        Product2Id: o.Product?.toString() || '',
        ProductName: o.ProductName,
        ProductCode: o.ProductCode,
        Quantity: o.Quantity,
        UnitPrice: o.UnitPrice,
        TotalPrice: o.TotalAmount,
      }],
    }));

    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch orders', details: err.message });
  }
});

// ─── GET /api/orders/:id ─────────────────────────────────────────────────────
// Get a specific order with tracking timeline
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const orderId = req.params.id;
    const order = await OrderModel.findOne({
      $or: [
        { sfId: orderId },
        { _id: mongoose.Types.ObjectId.isValid(orderId) ? orderId : undefined },
      ].filter(Boolean),
      user: dbUser._id,
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    const items = [{
      ProductName: order.ProductName,
      ProductCode: order.ProductCode,
      Quantity: order.Quantity,
      UnitPrice: order.UnitPrice,
      TotalPrice: order.TotalAmount,
    }];

    // Build tracking timeline based on status
    const timeline = [
      { title: 'Order Placed', date: order.CreatedDate, done: true, desc: 'Order submitted to Salesforce' },
    ];
    if (order.Status === 'Processing') {
      timeline.push({ title: 'Processing', date: order.CreatedDate, done: true, desc: 'Order under review at factory' });
      timeline.push({ title: 'Shipped', date: 'Pending', done: false, desc: 'Awaiting dispatch' });
      timeline.push({ title: 'Delivered', date: 'Pending', done: false, desc: 'Awaiting delivery' });
    } else if (order.Status === 'Shipped') {
      timeline.push({ title: 'Processing', date: order.CreatedDate, done: true, desc: 'Order processed' });
      timeline.push({ title: 'Shipped', date: order.CreatedDate, done: true, desc: `Dispatched (Track: ${order.TrackingNumber || 'N/A'})` });
      timeline.push({ title: 'Delivered', date: 'Pending', done: false, desc: 'In transit' });
    } else if (order.Status === 'Delivered') {
      timeline.push({ title: 'Processing', date: order.CreatedDate, done: true, desc: 'Order processed' });
      timeline.push({ title: 'Shipped', date: order.CreatedDate, done: true, desc: `Dispatched (Track: ${order.TrackingNumber || 'N/A'})` });
      timeline.push({ title: 'Delivered', date: order.DeliveryDate || order.CreatedDate, done: true, desc: 'Delivered successfully' });
    } else if (order.Status === 'Cancelled') {
      timeline.push({ title: 'Cancelled', date: order.CreatedDate, done: true, desc: 'Order was cancelled' });
    } else {
      timeline.push({ title: 'Processing', date: 'Pending', done: false, desc: 'Awaiting factory review' });
      timeline.push({ title: 'Shipped', date: 'Pending', done: false, desc: 'Awaiting dispatch' });
      timeline.push({ title: 'Delivered', date: 'Pending', done: false, desc: 'Awaiting delivery' });
    }

    res.json({
      Id: order.sfId || order._id.toString(),
      sfId: order.sfId,
      OrderNumber: order.OrderNumber,
      Status: order.Status,
      TotalAmount: order.TotalAmount,
      EffectiveDate: order.CreatedDate,
      DeliveryDate__c: order.DeliveryDate,
      Tracking_Number__c: order.TrackingNumber,
      ShippingCity: order.ShippingCity,
      CustomerName: [order.CustomerFirstName, order.CustomerLastName].filter(Boolean).join(' ') || null,
      CustomerEmail: order.CustomerEmail || null,
      CustomerPhone: order.CustomerPhone || null,
      AppliedScheme: order.AppliedScheme || '',
      DiscountAmount: order.DiscountAmount || 0,
      items,
      timeline,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch order details', details: err.message });
  }
});

// ─── POST /api/orders ─────────────────────────────────────────────────────────
// Places a new order in Salesforce on behalf of a customer
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const {
      productId, quantity, shippingCity,
      customerFirstName, customerLastName, customerEmail, customerPhone,
      appliedSchemeId,
    } = req.body;

    if (!customerFirstName || !customerLastName) {
      return res.status(400).json({ error: 'Customer first name and last name are required.' });
    }
    if (!customerPhone) {
      return res.status(400).json({ error: 'Customer phone is required.' });
    }
    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Please select a valid product and quantity.' });
    }

    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    // Find product (MongoDB or sfDB fallback)
    let product = await ProductModel.findOne({
      $or: [
        { Id: productId },
        { _id: mongoose.Types.ObjectId.isValid(productId) ? productId : undefined },
      ].filter(Boolean),
    });
    if (!product) {
      const sfProduct = sfDB.get('products').find({ Id: productId }).value();
      if (sfProduct) {
        const pb = sfDB.get('pricebooks').find({ Product2Id: sfProduct.Id }).value();
        product = { ...sfProduct, UnitPrice: pb?.UnitPrice || 0, ProductCode: sfProduct.ProductCode };
      }
    }
    if (!product) return res.status(400).json({ error: 'Product not found' });

    let totalAmount = product.UnitPrice * quantity;
    let discountAmount = 0;
    let appliedScheme = '';

    if (appliedSchemeId) {
      const scheme = sfDB.get('dealerSchemes').find({ Id: appliedSchemeId, IsActive__c: true }).value();
      if (scheme) {
        if (totalAmount >= scheme.Min_Order_Value__c && totalAmount <= (scheme.Max_Order_Value__c || Infinity)) {
          discountAmount = totalAmount * (scheme.Discount_Percentage__c / 100);
          totalAmount -= discountAmount;
          appliedScheme = scheme.Scheme_Name__c || scheme.Id;
        }
      }
    }

    // Generate local fallback order number
    const orderCount = await OrderModel.countDocuments();
    const generatedOrderNumber = `ORD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, '0')}`;

    let sfId: string | undefined;
    let finalOrderNumber = generatedOrderNumber;

    // Create Order in Salesforce
    try {
      console.log(`[ORDERS] Creating Dealer Order in SF for Account ${req.user.accountId}...`);
      const sfResult = await createSFOrder({
        accountId: req.user.accountId,
        productId: product.Id,
        quantity,
        unitPrice: product.UnitPrice,
        totalAmount,
        shippingCity: shippingCity || 'N/A',
        userId: req.user.userId,
        appliedScheme,
        discountAmount,
        customerFirstName,
        customerLastName,
        customerEmail: customerEmail || '',
        customerPhone,
      });
      sfId = sfResult.id;
      finalOrderNumber = sfResult.name || finalOrderNumber;
      console.log(`[ORDERS] ✅ SF Order created: ${sfId}, Ref: ${finalOrderNumber}`);
    } catch (sfErr: any) {
      console.error('[ORDERS] ❌ SF order failed (storing locally):', sfErr.message);
      // Non-blocking: keep local copy even if SF fails
    }

    // Save to MongoDB
    const newOrder = new OrderModel({
      user: dbUser._id,
      accountId: req.user.accountId,
      sfId,
      OrderNumber: finalOrderNumber,
      Product: product._id,
      ProductName: product.Name,
      ProductCode: product.ProductCode || '',
      Quantity: quantity,
      UnitPrice: product.UnitPrice,
      TotalAmount: totalAmount,
      Status: 'Pending',
      ShippingCity: shippingCity || 'N/A',
      AppliedScheme: appliedScheme,
      DiscountAmount: discountAmount,
      CustomerFirstName: customerFirstName,
      CustomerLastName: customerLastName,
      CustomerEmail: customerEmail || '',
      CustomerPhone: customerPhone,
    } as any);
    await newOrder.save();

    res.status(201).json({
      Id: newOrder.sfId || newOrder._id.toString(),
      OrderNumber: newOrder.OrderNumber,
      Status: newOrder.Status,
      TotalAmount: newOrder.TotalAmount,
      CustomerName: `${customerFirstName} ${customerLastName}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to place order', details: err.message });
  }
});

export default router;
