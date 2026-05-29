import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { CaseModel } from '../models/Case';
import { createSFCase } from '../services/salesforce';

const router = Router();

// GET /api/warranty/cases - Fetch warranty claim cases for this dealer
router.get('/cases', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    // Fetch cases that are warranty claims (stored with Type = Warranty Claim in subject prefix)
    const cases = await CaseModel.find({
      user: dbUser._id,
      accountId: req.user.accountId,
      Subject: { $regex: /\[Warranty\]/i },
    }).sort({ CreatedDate: -1 }).lean();

    const mapped = cases.map(c => ({
      Id: c.sfId || (c as any)._id.toString(),
      CaseNumber: c.CaseNumber,
      Subject: c.Subject,
      Description: c.Description,
      Priority: c.Priority,
      Status: c.Status,
      CreatedDate: c.CreatedDate,
      LastModifiedDate: c.LastModifiedDate,
      Resolution__c: c.Resolution__c,
      CustomerName: (c as any).CustomerName || null,
      CustomerEmail: (c as any).CustomerEmail || null,
      CustomerPhone: (c as any).CustomerPhone || null,
      OrderId: (c as any).OrderId || null,
    }));

    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch warranty cases', details: err.message });
  }
});

// POST /api/warranty/claim - Create a Warranty Claim Case in Salesforce
router.post('/claim', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, email, phone, orderId, description, priority } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'Customer first and last name are required.' });
    }
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required for warranty claims.' });
    }
    if (!description) {
      return res.status(400).json({ error: 'Issue description is required.' });
    }

    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const customerName = `${firstName.trim()} ${lastName.trim()}`;
    const subject = `[Warranty] ${customerName} - Order: ${orderId}`;
    const caseNum = `WC-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`;
    const today = new Date().toISOString().split('T')[0];

    let sfId: string | undefined;
    let finalCaseNumber = caseNum;

    try {
      console.log(`[WARRANTY] Creating Warranty Claim Case in Salesforce...`);
      const sfResult = await createSFCase({
        subject,
        description,
        priority: priority || 'High',
        accountId: req.user.accountId,
        customerName,
        customerEmail: email || null,
        customerPhone: phone || null,
        orderId: orderId || null,
      });
      sfId = sfResult.id;
      if (sfResult.caseNumber) finalCaseNumber = sfResult.caseNumber;
      console.log(`[WARRANTY] ✅ Warranty Case created in SF: ${sfId}, Number: ${finalCaseNumber}`);
    } catch (sfErr: any) {
      console.error(`[WARRANTY] ❌ Salesforce Warranty Case creation failed:`, sfErr.message);
      return res.status(500).json({ error: 'Salesforce case creation failed', details: sfErr.message });
    }

    const newCase = new CaseModel({
      user: dbUser._id,
      accountId: req.user.accountId,
      sfId,
      CaseNumber: finalCaseNumber,
      Subject: subject,
      Description: description,
      Priority: priority || 'High',
      Status: 'New',
      CreatedDate: today,
      LastModifiedDate: today,
      Resolution__c: null,
      CustomerName: customerName,
      CustomerEmail: email || null,
      CustomerPhone: phone || null,
      OrderId: orderId,
    } as any);

    await newCase.save();

    res.status(201).json({
      Id: newCase.sfId,
      CaseNumber: newCase.CaseNumber,
      Subject: newCase.Subject,
      Status: newCase.Status,
      CustomerName: customerName,
      OrderId: orderId,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create warranty claim', details: err.message });
  }
});

export default router;
