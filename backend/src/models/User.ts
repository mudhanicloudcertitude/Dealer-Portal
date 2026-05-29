import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  id: string;
  email: string;
  password: string;
  accountId: string;
  role: string;
  name: string;
  createdAt: string;
}

const UserSchema = new Schema<IUser>({
  id: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  accountId: { type: String, required: true },
  role: { type: String, required: true, default: 'dealer' },
  name: { type: String, required: true },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

export const User = mongoose.model<IUser>('User', UserSchema);
