import { Router } from 'express';
import { sfDB } from '../db/init';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { ProductModel } from '../models/Product';
import { InventoryModel } from '../models/Inventory';

const router = Router();

// GET /api/inventory - Dealer's current stock from MongoDB
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const accountId = req.user.accountId;
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found in local database' });

    // Fetch local MongoDB inventory records
    let inventory = await InventoryModel.find({ user: dbUser._id });

    // If completely empty, auto-seed from standard mock inventory to provide a pre-populated B2B experience
    if (inventory.length === 0) {
      console.log(`[INVENTORY] Auto-seeding initial MongoDB inventory for user: ${dbUser.name}`);
      const defaultMockStock = sfDB.get('dealerInventory').filter({ Dealer__c: accountId }).value();
      
      for (const item of defaultMockStock) {
        const localProduct = await ProductModel.findOne({ Id: item.Product2Id });
        if (localProduct) {
          const newInv = new InventoryModel({
            user: dbUser._id,
            accountId,
            Product: localProduct._id,
            Product2Id: item.Product2Id,
            Product_Name__c: item.Product_Name__c,
            Stock_On_Hand__c: item.Stock_On_Hand__c,
            Min_Stock_Level__c: item.Min_Stock_Level__c || 10,
            Last_Audit_Date__c: item.Last_Audit_Date__c || new Date().toISOString().split('T')[0]
          });
          await newInv.save();
        }
      }
      // Re-query
      inventory = await InventoryModel.find({ user: dbUser._id });
    }

    // Enrich with pricebook demand and price info for UI replenishment charts
    const pricebooks = sfDB.get('pricebooks').value();
    const enriched = inventory.map((item: any) => {
      const pb = pricebooks.find((p: any) => p.Product2Id === item.Product2Id);
      const pct = item.Min_Stock_Level__c > 0 
        ? Math.min(100, Math.round((item.Stock_On_Hand__c / item.Min_Stock_Level__c) * 100))
        : 100;
        
      return {
        Id: item._id.toString(),
        Product2Id: item.Product2Id,
        Product_Name__c: item.Product_Name__c,
        Stock_On_Hand__c: item.Stock_On_Hand__c,
        Min_Stock_Level__c: item.Min_Stock_Level__c,
        Last_Audit_Date__c: item.Last_Audit_Date__c,
        isLowStock: item.Stock_On_Hand__c < item.Min_Stock_Level__c,
        stockHealthPercent: pct,
        Forecasted_Demand__c: pb?.Forecasted_Demand__c || 120,
        Restock_Recommendation__c: pb?.Restock_Recommendation__c || 40,
        UnitPrice: pb?.UnitPrice || 5000,
      };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch inventory', details: err.message });
  }
});

// PUT /api/inventory/:id - Update stock directly in MongoDB (physical audit)
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { Stock_On_Hand__c, Last_Audit_Date__c } = req.body;
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found in local database' });

    const updated = await InventoryModel.findOneAndUpdate(
      { _id: req.params.id, user: dbUser._id },
      { 
        Stock_On_Hand__c: Number(Stock_On_Hand__c) || 0,
        Last_Audit_Date__c: Last_Audit_Date__c || new Date().toISOString().split('T')[0]
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Inventory record not found or unauthorized' });
    }

    res.json({ success: true, message: 'Stock updated successfully', item: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update stock', details: err.message });
  }
});

export default router;
