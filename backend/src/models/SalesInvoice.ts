import mongoose, { Document, Schema } from 'mongoose';

export type SalesInvoiceStatus = 'Pending' | 'Paid' | 'Overdue' | 'Cancelled';

export interface ISalesInvoice extends Document {
  user: mongoose.Types.ObjectId;
  customer: mongoose.Types.ObjectId;
  salesOrder: mongoose.Types.ObjectId;
  invoiceNumber: string;
  amount: number;
  status: SalesInvoiceStatus;
  dueDate: string;
  paidDate?: string;
  paymentRef?: string;
  notes?: string;
  createdAt: string;
}

const SalesInvoiceSchema = new Schema<ISalesInvoice>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  salesOrder: { type: Schema.Types.ObjectId, ref: 'SalesOrder', required: true },
  invoiceNumber: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['Pending', 'Paid', 'Overdue', 'Cancelled'],
    default: 'Pending',
  },
  dueDate: { type: String, required: true },
  paidDate: { type: String, default: null },
  paymentRef: { type: String, default: '' },
  notes: { type: String, default: '' },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

export const SalesInvoiceModel = mongoose.model<ISalesInvoice>('SalesInvoice', SalesInvoiceSchema);
