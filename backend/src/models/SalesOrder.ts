import mongoose, { Document, Schema } from 'mongoose';

export type SalesOrderStatus = 'Pending' | 'Confirmed' | 'Delivered' | 'Cancelled';

export interface ISalesOrder extends Document {
  user: mongoose.Types.ObjectId;
  customer: mongoose.Types.ObjectId;
  opportunity: mongoose.Types.ObjectId;
  inventoryItem: mongoose.Types.ObjectId;
  orderNumber: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  status: SalesOrderStatus;
  notes?: string;
  stockRestored: boolean;   // prevent double restore on multiple cancel calls
  createdAt: string;
  updatedAt: string;
}

const SalesOrderSchema = new Schema<ISalesOrder>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  opportunity: { type: Schema.Types.ObjectId, ref: 'Opportunity', required: true },
  inventoryItem: { type: Schema.Types.ObjectId, ref: 'Inventory', required: true },
  orderNumber: { type: String, required: true, unique: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Delivered', 'Cancelled'],
    default: 'Pending',
  },
  notes: { type: String, default: '' },
  stockRestored: { type: Boolean, default: false },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
});

export const SalesOrderModel = mongoose.model<ISalesOrder>('SalesOrder', SalesOrderSchema);
