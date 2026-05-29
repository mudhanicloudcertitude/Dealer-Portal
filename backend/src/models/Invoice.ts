import mongoose, { Document, Schema } from 'mongoose';

export interface IInvoice extends Document {
  user: mongoose.Types.ObjectId;      // Lookup to local MongoDB User
  accountId: string;                  // Salesforce Account ID (Dealer)
  sfId: string;                       // Salesforce Dealer_Invoice__c ID
  InvoiceNumber: string;              // E.g., INV-0001
  OrderId: string;                    // Salesforce Order ID
  Amount: number;
  DueDate: string;
  PaymentDate?: string;
  Status: 'Pending' | 'On Hold' | 'Cancelled' | 'Completed';
  BankDetails?: string;               // Transaction reference, bank name, etc.
  CreatedDate: string;
}

const InvoiceSchema = new Schema<IInvoice>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  accountId: { type: String, required: true },
  sfId: { type: String, required: true, unique: true },
  InvoiceNumber: { type: String, required: true },
  OrderId: { type: String, required: true },
  Amount: { type: Number, required: true },
  DueDate: { type: String, required: true },
  PaymentDate: { type: String, default: null },
  Status: {
    type: String,
    enum: ['Pending', 'On Hold', 'Cancelled', 'Completed'],
    default: 'Pending'
  },
  BankDetails: { type: String, default: null },
  CreatedDate: { type: String, default: () => new Date().toISOString().split('T')[0] }
});

export const InvoiceModel = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
