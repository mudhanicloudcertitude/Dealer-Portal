import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  Id: string;              // Salesforce Product ID
  Name: string;
  ProductCode: string;
  Family: string;
  Description: string;
  IsActive: boolean;
  StockKeepingUnit: string;
  UnitPrice: number;
  ListPrice: number;
  Forecasted_Demand__c: number;
  Restock_Recommendation__c: number;
}

const ProductSchema = new Schema<IProduct>({
  Id: { type: String, required: true, unique: true },
  Name: { type: String, required: true },
  ProductCode: { type: String, required: true },
  Family: { type: String, required: true },
  Description: { type: String, default: '' },
  IsActive: { type: Boolean, default: true },
  StockKeepingUnit: { type: String, default: '' },
  UnitPrice: { type: Number, required: true },
  ListPrice: { type: Number, required: true },
  Forecasted_Demand__c: { type: Number, default: 0 },
  Restock_Recommendation__c: { type: Number, default: 0 },
});

export const ProductModel = mongoose.model<IProduct>('Product', ProductSchema);
