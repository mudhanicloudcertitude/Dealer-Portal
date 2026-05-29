import { Router } from 'express';
import mongoose from 'mongoose';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { CaseModel } from '../models/Case';
import { createSFCase } from '../services/salesforce';

const router = Router();

// GET /api/cases
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found in local database' });

    const cases = await CaseModel.find({ user: dbUser._id, accountId: req.user.accountId }).sort({ CreatedDate: -1 }).lean();

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
    res.status(500).json({ error: 'Failed to fetch cases', details: err.message });
  }
});

// POST /api/cases - Create new support case with customer details
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, email, phone, orderId, subject, description, priority } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'Customer first name and last name are required.' });
    }
    if (!subject) {
      return res.status(400).json({ error: 'Case subject is required.' });
    }

    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found in local database' });

    const customerName = `${firstName.trim()} ${lastName.trim()}`;
    const caseNum = `CS-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`;
    const today = new Date().toISOString().split('T')[0];

    let sfId: string | undefined;
    let finalCaseNumber = caseNum;

    try {
      console.log(`[CASES] Creating Case in Salesforce for Account ${req.user.accountId}...`);
      const sfResult = await createSFCase({
        subject,
        description: description || '',
        priority: priority || 'Medium',
        accountId: req.user.accountId,
        customerName,
        customerEmail: email || null,
        customerPhone: phone || null,
        orderId: orderId || null,
      });
      sfId = sfResult.id;
      if (sfResult.caseNumber) {
        finalCaseNumber = sfResult.caseNumber;
      }
      console.log(`[CASES] ✅ Case created in Salesforce with ID: ${sfId}, CaseNumber: ${finalCaseNumber}`);
    } catch (sfErr: any) {
      console.error(`[CASES] ❌ Salesforce Case creation failed:`, sfErr.message);
      return res.status(500).json({ error: 'Salesforce Case creation failed', details: sfErr.message });
    }

    const newCase = new CaseModel({
      user: dbUser._id,
      accountId: req.user.accountId,
      sfId: sfId,
      CaseNumber: finalCaseNumber,
      Subject: subject,
      Description: description || '',
      Priority: priority || 'Medium',
      Status: 'New',
      CreatedDate: today,
      LastModifiedDate: today,
      Resolution__c: null,
      CustomerName: customerName,
      CustomerEmail: email || null,
      CustomerPhone: phone || null,
      OrderId: orderId || null,
    } as any);

    await newCase.save();

    res.status(201).json({
      Id: newCase.sfId,
      CaseNumber: newCase.CaseNumber,
      Subject: newCase.Subject,
      Description: newCase.Description,
      Priority: newCase.Priority,
      Status: newCase.Status,
      CreatedDate: newCase.CreatedDate,
      LastModifiedDate: newCase.LastModifiedDate,
      Resolution__c: newCase.Resolution__c,
      CustomerName: customerName,
      CustomerEmail: email || null,
      CustomerPhone: phone || null,
      OrderId: orderId || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create case', details: err.message });
  }
});

export default router;
