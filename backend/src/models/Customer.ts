import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomer extends Document {
  user: mongoose.Types.ObjectId;
  opportunity: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  email: string;        // Unique per user — used to deduplicate on Won
  companyName: string;
  customerSince: string;
  createdAt: string;
}

const CustomerSchema = new Schema<ICustomer>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  opportunity: { type: Schema.Types.ObjectId, ref: 'Opportunity', required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  companyName: { type: String, required: true },
  customerSince: { type: String, default: () => new Date().toISOString().split('T')[0] },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

// Email is unique per user (same customer shouldn't be duplicated per dealer)
CustomerSchema.index({ user: 1, email: 1 }, { unique: true });

export const CustomerModel = mongoose.model<ICustomer>('Customer', CustomerSchema);
