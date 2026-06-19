import mongoose, { Document, Schema } from 'mongoose';

export interface IInventory extends Document {
  user: mongoose.Types.ObjectId;      // Lookup to local MongoDB User
  accountId: string;                  // Salesforce Account ID (Dealer)
  sfId: string;                       // Salesforce Dealer_Inventory__c record Id
  Product: mongoose.Types.ObjectId;   // Lookup to local MongoDB Product
  Product2Id: string;                 // Salesforce Product ID (Inventory__r.Product__c)
  Product_Name__c: string;            // Denormalized: Inventory__r.Product__r.Name
  Quantity__c: number;                // Stock quantity (Quantity__c on Dealer_Inventory__c)
  Amount__c?: number;                 // Total stock value (Amount__c on Dealer_Inventory__c)
}

const InventorySchema = new Schema<IInventory>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  accountId: { type: String, required: true },
  sfId: { type: String, default: '' },
  Product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  Product2Id: { type: String, required: true },
  Product_Name__c: { type: String, required: true },
  Quantity__c: { type: Number, default: 0 },
  Amount__c: { type: Number, default: 0 },
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
      invItem.Quantity__c += params.quantity;
      await invItem.save();
      console.log(`[INVENTORY TRIGGER] ✅ Incremented existing stock. New Total: ${invItem.Quantity__c}`);
    } else {
      // Create new stock record
      invItem = new InventoryModel({
        user: params.userId,
        accountId: params.accountId,
        Product: params.productId,
        Product2Id: params.product2Id,
        Product_Name__c: params.productName,
        Quantity__c: params.quantity,
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
