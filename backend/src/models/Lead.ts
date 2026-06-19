import mongoose, { Document, Schema } from 'mongoose';

export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Disqualified';
export type LeadSource = 'Walk-in' | 'Referral' | 'Social Media' | 'Exhibition' | 'Cold Call' | 'Other';

export interface ILead extends Document {
  user: mongoose.Types.ObjectId;
  sfId?: string;
  contactName: string;
  phone: string;
  email: string;
  companyName: string;
  source: LeadSource;
  status: LeadStatus;
  followUpDate?: string;
  notes?: string;
  convertedToOpportunity: boolean;
  createdAt: string;
  updatedAt: string;
}

const LeadSchema = new Schema<ILead>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sfId: { type: String, default: null },
  contactName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  companyName: { type: String, required: true },
  source: {
    type: String,
    enum: ['Walk-in', 'Referral', 'Social Media', 'Exhibition', 'Cold Call', 'Dealer Portal', 'Other'],
    required: true,
  },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Qualified', 'Disqualified', 'Open - Not Contacted', 'Working - Contacted', 'Closed - Converted', 'Closed - Not Converted'],
    default: 'New',
  },
  followUpDate: { type: String, default: null },
  notes: { type: String, default: '' },
  convertedToOpportunity: { type: Boolean, default: false },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
});

export const LeadModel = mongoose.model<ILead>('Lead', LeadSchema);
