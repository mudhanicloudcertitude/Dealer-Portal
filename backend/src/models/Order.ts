import mongoose, { Document, Schema } from 'mongoose';

export interface IOrder extends Document {
  user: mongoose.Types.ObjectId;      // Lookup linking to local MongoDB User
  accountId: string;                  // Salesforce Account ID (Dealer)
  sfId?: string;                      // Salesforce Dealer_Order__c Record ID (once synced)
  OrderNumber: string;                // User-facing order reference number
  Product: mongoose.Types.ObjectId;   // Lookup linking to local MongoDB Product
  ProductName: string;                // Denormalized product name for fast catalog query
  ProductCode: string;                // Denormalized product code
  Quantity: number;
  UnitPrice: number;
  TotalAmount: number;
  Status: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
  TrackingNumber?: string;
  DeliveryDate?: string;
  ShippingCity: string;
  AppliedScheme?: string;
  DiscountAmount?: number;
  InventoryCredited?: boolean;
  CreatedDate: string;
  // Customer details
  CustomerFirstName?: string;
  CustomerLastName?: string;
  CustomerEmail?: string;
  CustomerPhone?: string;
}

const OrderSchema = new Schema<IOrder>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  accountId: { type: String, required: true },
  sfId: { type: String, unique: true, sparse: true },
  OrderNumber: { type: String, required: true, unique: true },
  Product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  ProductName: { type: String, required: true },
  ProductCode: { type: String, required: true },
  Quantity: { type: Number, required: true },
  UnitPrice: { type: Number, required: true },
  TotalAmount: { type: Number, required: true },
  Status: { 
    type: String, 
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'], 
    default: 'Pending' 
  },
  TrackingNumber: { type: String, default: '' },
  DeliveryDate: { type: String, default: null },
  ShippingCity: { type: String, required: true },
  AppliedScheme: { type: String, default: '' },
  DiscountAmount: { type: Number, default: 0 },
  InventoryCredited: { type: Boolean, default: false },
  CreatedDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  // Customer details
  CustomerFirstName: { type: String, default: '' },
  CustomerLastName: { type: String, default: '' },
  CustomerEmail: { type: String, default: '' },
  CustomerPhone: { type: String, default: '' },
});

export const OrderModel = mongoose.model<IOrder>('Order', OrderSchema);
