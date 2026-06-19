import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { User } from '../src/models/User';

async function updateAccount() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log('Connected to MongoDB.');

    const result = await User.updateOne(
      { email: 'dealer@sunrise.com' },
      { $set: { accountId: '001gK0000133auLQAQ' } }
    );
    
    console.log('Update result:', result);
    
    // Also verify what's currently there
    const user = await User.findOne({ email: 'dealer@sunrise.com' });
    console.log('Current user accountId in DB:', user?.accountId);
    
  } catch (error) {
    console.error('Error updating user:', error);
  } finally {
    mongoose.disconnect();
    console.log('Disconnected.');
  }
}

updateAccount();
