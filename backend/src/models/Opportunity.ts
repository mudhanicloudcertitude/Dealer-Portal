import mongoose, { Document, Schema } from 'mongoose';

export type OpportunityStage = 'Prospecting' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost' | 'Closed Won' | 'Closed Lost';

export interface IOpportunity extends Document {
  user: mongoose.Types.ObjectId;
  sfId?: string;
  lead?: mongoose.Types.ObjectId;       // optional — null if created directly
  title: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  companyName: string;
  inventoryItem?: mongoose.Types.ObjectId;  // Lookup → Inventory (optional)
  productName: string;                      // denormalized
  quantity: number;
  unitPrice: number;
  expectedValue: number;                    // quantity * unitPrice
  stage: OpportunityStage;
  expectedCloseDate: string;
  probability: number;                      // 0–100
  lostReason?: string;
  notes?: string;
  wonAt?: string;
  createdAt: string;
  updatedAt: string;
}

const OpportunitySchema = new Schema<IOpportunity>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sfId: { type: String, default: null },
  lead: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },
  title: { type: String, required: true },
  contactName: { type: String, required: true },
  contactPhone: { type: String, required: true },
  contactEmail: { type: String, required: true },
  companyName: { type: String, required: true },
  inventoryItem: { type: Schema.Types.ObjectId, ref: 'Inventory', default: null },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  unitPrice: { type: Number, required: true, default: 0 },
  expectedValue: { type: Number, required: true, default: 0 },
  stage: {
    type: String,
    enum: ['Prospecting', 'Proposal', 'Negotiation', 'Won', 'Lost', 'Closed Won', 'Closed Lost'],
    default: 'Prospecting',
  },
  expectedCloseDate: { type: String, required: true },
  probability: { type: Number, default: 10, min: 0, max: 100 },
  lostReason: { type: String, default: '' },
  notes: { type: String, default: '' },
  wonAt: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
});

export const OpportunityModel = mongoose.model<IOpportunity>('Opportunity', OpportunitySchema);
