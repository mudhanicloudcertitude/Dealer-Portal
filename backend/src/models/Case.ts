import mongoose, { Document, Schema } from 'mongoose';

export interface ICase extends Document {
  user: mongoose.Types.ObjectId;  // Lookup field linking to MongoDB User
  accountId: string;              // Salesforce Account ID (Dealer)
  sfId: string;                   // Salesforce Case ID
  CaseNumber: string;             // Salesforce Case Number
  Subject: string;
  Description: string;
  Priority: string;
  Status: string;
  CreatedDate: string;
  LastModifiedDate: string;
  Resolution__c: string | null;  // Maps to Salesforce Resolution_Details__c
  CustomerName?: string;          // Full customer name
  CustomerEmail?: string;         // Customer email address
  CustomerPhone?: string;         // Customer phone number
  OrderId?: string;               // Optional linked Order ID
}

const CaseSchema = new Schema<ICase>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  accountId: { type: String, required: true },
  sfId: { type: String, unique: true, required: true },
  CaseNumber: { type: String, required: true },
  Subject: { type: String, required: true },
  Description: { type: String, default: '' },
  Priority: { type: String, required: true },
  Status: { type: String, required: true },
  CreatedDate: { type: String, required: true },
  LastModifiedDate: { type: String, required: true },
  Resolution__c: { type: String, default: null },
  CustomerName: { type: String, default: null },
  CustomerEmail: { type: String, default: null },
  CustomerPhone: { type: String, default: null },
  OrderId: { type: String, default: null },
});

export const CaseModel = mongoose.model<ICase>('Case', CaseSchema);
