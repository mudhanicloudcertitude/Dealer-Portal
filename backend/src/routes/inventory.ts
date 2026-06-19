import { Router } from 'express';
import { sfDB } from '../db/init';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { ProductModel } from '../models/Product';
import { InventoryModel } from '../models/Inventory';

const router = Router();

// GET /api/inventory - Dealer's current stock from MongoDB (synced from Dealer_Inventory__c)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const accountId = req.user.accountId;
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found in local database' });

    // Fetch local MongoDB inventory records
    let inventory = await InventoryModel.find({ user: dbUser._id });

    // If completely empty, auto-seed from mock data (fallback for demo/mock accounts)
    if (inventory.length === 0) {
      console.log(`[INVENTORY] Auto-seeding initial MongoDB inventory for user: ${dbUser.name}`);
      const defaultMockStock = sfDB.get('dealerInventory').filter({ Dealer__c: accountId }).value();

      for (const item of defaultMockStock) {
        const localProduct = await ProductModel.findOne({ Id: item.Product2Id });
        if (localProduct) {
          const newInv = new InventoryModel({
            user: dbUser._id,
            accountId,
            sfId: item.Id || '',
            Product: localProduct._id,
            Product2Id: item.Product2Id,
            Product_Name__c: item.Product_Name__c,
            Quantity__c: item.Quantity__c || item.Stock_On_Hand__c || 0,
            Amount__c: item.Amount__c || 0,
          });
          await newInv.save();
        }
      }
      // Re-query after seeding
      inventory = await InventoryModel.find({ user: dbUser._id });
    }

    // Enrich with pricebook data for pricing and AI demand info
    const pricebooks = sfDB.get('pricebooks').value();
    const enriched = inventory.map((item: any) => {
      const pb = pricebooks.find((p: any) => p.Product2Id === item.Product2Id);

      return {
        Id: item._id.toString(),
        sfId: item.sfId || '',
        Product2Id: item.Product2Id,
        Product_Name__c: item.Product_Name__c,
        Quantity__c: item.Quantity__c,
        Amount__c: item.Amount__c || (item.Quantity__c || 0) * (pb?.UnitPrice || 0),
        Forecasted_Demand__c: pb?.Forecasted_Demand__c || 0,
        Restock_Recommendation__c: pb?.Restock_Recommendation__c || 0,
        UnitPrice: pb?.UnitPrice || 0,
      };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch inventory', details: err.message });
  }
});

// PUT /api/inventory/:id - Manually update stock quantity in MongoDB
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { Quantity__c } = req.body;
    const dbUser = await User.findOne({ id: req.user.userId });
    if (!dbUser) return res.status(404).json({ error: 'User not found in local database' });

    const updated = await InventoryModel.findOneAndUpdate(
      { _id: req.params.id, user: dbUser._id },
      { Quantity__c: Number(Quantity__c) || 0 },
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
