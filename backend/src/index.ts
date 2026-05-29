import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectMongoDB } from './db/mongo';
import { initDatabases } from './db/init';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import inventoryRoutes from './routes/inventory';
import schemeRoutes from './routes/schemes';
import warrantyRoutes from './routes/warranty';
import paymentRoutes from './routes/payments';
import caseRoutes from './routes/cases';
import dashboardRoutes from './routes/dashboard';
import syncRoutes from './routes/sync';
import leadRoutes from './routes/leads';
import opportunityRoutes from './routes/opportunities';
import customerRoutes from './routes/customers';
import salesOrderRoutes from './routes/sales-orders';
import salesInvoiceRoutes from './routes/sales-invoices';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Connect to MongoDB Atlas (users collection)
connectMongoDB().then(async () => {
  // After MongoDB is ready, seed default user if none exists
  const { User } = await import('./models/User');
  const bcrypt = await import('bcryptjs');
  const { sfDB } = await import('./db/init');
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    const defaultAccount = sfDB.get('accounts').find({ Id: 'ACC001' }).value();
    if (defaultAccount) {
      await User.create({
        id: 'USR001',
        email: 'dealer@sunrise.com',
        password: bcrypt.hashSync('dealer123', 10),
        accountId: 'ACC001',
        role: 'dealer',
        name: 'Raj Sharma',
        createdAt: new Date().toISOString(),
      });
      console.log('✅ Default dealer user seeded to MongoDB Atlas');
      console.log('   Login: dealer@sunrise.com / dealer123');
    }
  }
});

// Initialize local mock Salesforce databases and seed data
initDatabases();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/schemes', schemeRoutes);
app.use('/api/warranty', warrantyRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sync', syncRoutes);
// ── Sales Pipeline Routes ───────────────────────────────────────────
app.use('/api/leads', leadRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/sales-invoices', salesInvoiceRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '1.0.0' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Dealer Portal Backend running on http://localhost:${PORT}`);
  console.log(`📊 Mock Salesforce Engine: ACTIVE`);
  console.log(`🔄 Sync Scheduler: DISABLED (Realtime on-login sync enabled)\n`);
});

export default app;
