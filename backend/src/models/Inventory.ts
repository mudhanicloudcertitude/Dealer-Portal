import mongoose, { Document, Schema } from 'mongoose';

export interface IInventory extends Document {
  user: mongoose.Types.ObjectId;      // Lookup to local MongoDB User
  accountId: string;                  // Salesforce Account ID (Dealer)
  Product: mongoose.Types.ObjectId;   // Lookup to local MongoDB Product
  Product2Id: string;                 // Salesforce Product ID lookup
  Product_Name__c: string;            // Denormalized product name for fast catalog query
  Stock_On_Hand__c: number;
  Min_Stock_Level__c: number;
  Last_Audit_Date__c: string;
}

const InventorySchema = new Schema<IInventory>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  accountId: { type: String, required: true },
  Product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  Product2Id: { type: String, required: true },
  Product_Name__c: { type: String, required: true },
  Stock_On_Hand__c: { type: Number, default: 0 },
  Min_Stock_Level__c: { type: Number, default: 10 },
  Last_Audit_Date__c: { type: String, default: () => new Date().toISOString().split('T')[0] }
});

// Ensure compound index to prevent duplicate user-product inventory records
InventorySchema.index({ user: 1, Product: 1 }, { unique: true });

export const InventoryModel = mongoose.model<IInventory>('Inventory', InventorySchema);

/**
 * Utility function to credit inventory when an order gets delivered
 */
export async function creditLocalInventory(params: {
  userId: mongoose.Types.ObjectId | string;
  accountId: string;
  productId: mongoose.Types.ObjectId | string;
  product2Id: string;
  productName: string;
  quantity: number;
}) {
  try {
    console.log(`[INVENTORY TRIGGER] Crediting local inventory: Product ${params.productName}, Quantity ${params.quantity}`);
    
    // Look up existing inventory record for this user and product
    let invItem = await InventoryModel.findOne({
      user: params.userId,
      Product: params.productId
    });

    if (invItem) {
      // Increment stock
      invItem.Stock_On_Hand__c += params.quantity;
      invItem.Last_Audit_Date__c = new Date().toISOString().split('T')[0];
      await invItem.save();
      console.log(`[INVENTORY TRIGGER] ✅ Incremented existing stock. New Total: ${invItem.Stock_On_Hand__c}`);
    } else {
      // Create new stock record
      invItem = new InventoryModel({
        user: params.userId,
        accountId: params.accountId,
        Product: params.productId,
        Product2Id: params.product2Id,
        Product_Name__c: params.productName,
        Stock_On_Hand__c: params.quantity,
        Min_Stock_Level__c: 10, // Safe default threshold
        Last_Audit_Date__c: new Date().toISOString().split('T')[0]
      });
      await invItem.save();
      console.log(`[INVENTORY TRIGGER] ✅ Created new stock record for product. Stock: ${params.quantity}`);
    }
    return invItem;
  } catch (err: any) {
    console.error('[INVENTORY TRIGGER] ❌ Failed to credit inventory:', err.message);
    throw err;
  }
}
