import low from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';
import path from 'path';
import fs from 'fs';
import { stableObjectId } from './mockHydrate';

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ─── Mock Salesforce Database ───────────────────────────────────────────────
// Simulates Salesforce Manufacturing Cloud objects as the source of truth
const sfAdapter = new FileSync(path.join(dataDir, 'salesforce_mock.json'));
export const sfDB = low(sfAdapter);

// ─── Portal Cache Database ───────────────────────────────────────────────────
// Stores users, sessions, synced snapshots, logs
const cacheAdapter = new FileSync(path.join(dataDir, 'portal_cache.json'));
export const cacheDB = low(cacheAdapter);

export function initDatabases() {
  // Salesforce Mock defaults
  sfDB.defaults({
    accounts: [],       // Account (Dealer)
    opportunities: [],  // Opportunity
    leads: [],          // Lead
    orders: [],         // Order
    orderItems: [],     // OrderItem
    products: [],       // Product2
    pricebooks: [],     // PricebookEntry
    dealerInventory: [], // Dealer_Inventory__c
    warrantyRegs: [],   // Warranty_Registration__c
    dealerSchemes: [],  // Dealer_Scheme__c
    dealerPayments: [], // Dealer_Payment__c
    cases: [],          // Case
    syncLog: [],        // Internal sync log
  }).write();

  // Portal Cache defaults
  cacheDB.defaults({
    users: [],
    sessions: [],
    cachedProducts: [],
    cachedOrders: [],
    cachedInventory: [],
    cachedPayments: [],
    cachedWarranty: [],
    leads: [],
    opportunities: [],
    activityLog: [],
    notifications: [],
  }).write();

  console.log('✅ Databases initialized');

  // Seed data if empty
  if (sfDB.get('accounts').value().length === 0) {
    seedSalesforceData();
  }
}

function seedSalesforceData() {
  console.log('🌱 Seeding Mock Salesforce Data...');

  // Seed Products
  const products = [
    { Id: 'P001', Name: 'Industrial Pump X200', ProductCode: 'IPX200', Family: 'Pumps', Description: 'High-performance industrial pump', IsActive: true, StockKeepingUnit: 'IPX200-001' },
    { Id: 'P002', Name: 'Hydraulic Motor HM500', ProductCode: 'HM500', Family: 'Motors', Description: 'Heavy-duty hydraulic motor', IsActive: true, StockKeepingUnit: 'HM500-001' },
    { Id: 'P003', Name: 'Control Valve CV100', ProductCode: 'CV100', Family: 'Valves', Description: 'Precision control valve', IsActive: true, StockKeepingUnit: 'CV100-001' },
    { Id: 'P004', Name: 'Pressure Gauge PG50', ProductCode: 'PG50', Family: 'Gauges', Description: 'Digital pressure gauge', IsActive: true, StockKeepingUnit: 'PG50-001' },
    { Id: 'P005', Name: 'Filtration Unit FU300', ProductCode: 'FU300', Family: 'Filters', Description: 'Industrial filtration unit', IsActive: true, StockKeepingUnit: 'FU300-001' },
    { Id: 'P006', Name: 'Compressor CP750', ProductCode: 'CP750', Family: 'Compressors', Description: 'High-capacity air compressor', IsActive: true, StockKeepingUnit: 'CP750-001' },
  ];

  const pricebooks = [
    { Id: 'PBE001', Product2Id: 'P001', UnitPrice: 45000, ListPrice: 50000, IsActive: true, Forecasted_Demand__c: 120, Restock_Recommendation__c: 50 },
    { Id: 'PBE002', Product2Id: 'P002', UnitPrice: 78000, ListPrice: 85000, IsActive: true, Forecasted_Demand__c: 80, Restock_Recommendation__c: 30 },
    { Id: 'PBE003', Product2Id: 'P003', UnitPrice: 12000, ListPrice: 14000, IsActive: true, Forecasted_Demand__c: 200, Restock_Recommendation__c: 80 },
    { Id: 'PBE004', Product2Id: 'P004', UnitPrice: 3500, ListPrice: 4000, IsActive: true, Forecasted_Demand__c: 350, Restock_Recommendation__c: 150 },
    { Id: 'PBE005', Product2Id: 'P005', UnitPrice: 28000, ListPrice: 32000, IsActive: true, Forecasted_Demand__c: 90, Restock_Recommendation__c: 40 },
    { Id: 'PBE006', Product2Id: 'P006', UnitPrice: 125000, ListPrice: 140000, IsActive: true, Forecasted_Demand__c: 45, Restock_Recommendation__c: 20 },
  ];

  // Seed Dealer Accounts
  const accounts = [
    { Id: 'ACC001', Name: 'Sunrise Industries Pvt Ltd', Dealer_ID__c: 'DLR001', RecordType: 'Dealer', Credit_Limit__c: 5000000, Outstanding_Amount__c: 1250000, Status__c: 'Active', City__c: 'Mumbai', State__c: 'Maharashtra', Email__c: 'dealer@sunrise.com', Phone: '9876543210', Tier__c: 'Gold', Join_Date__c: '2022-01-15' },
    { Id: 'ACC002', Name: 'TechMech Solutions', Dealer_ID__c: 'DLR002', RecordType: 'Dealer', Credit_Limit__c: 3000000, Outstanding_Amount__c: 890000, Status__c: 'Active', City__c: 'Pune', State__c: 'Maharashtra', Email__c: 'dealer@techmech.com', Phone: '9876543211', Tier__c: 'Silver', Join_Date__c: '2022-06-20' },
  ];

  // Seed Orders
  const orders = [
    { Id: 'ORD001', AccountId: 'ACC001', OrderNumber: 'ORD-2024-001', Status: 'Delivered', TotalAmount: 135000, EffectiveDate: '2024-01-10', DeliveryDate__c: '2024-01-20', Tracking_Number__c: 'TRK123456', ShippingCity: 'Mumbai' },
    { Id: 'ORD002', AccountId: 'ACC001', OrderNumber: 'ORD-2024-002', Status: 'Processing', TotalAmount: 234000, EffectiveDate: '2024-02-15', DeliveryDate__c: '2024-03-01', Tracking_Number__c: 'TRK789012', ShippingCity: 'Mumbai' },
    { Id: 'ORD003', AccountId: 'ACC001', OrderNumber: 'ORD-2024-003', Status: 'Shipped', TotalAmount: 78000, EffectiveDate: '2024-02-20', DeliveryDate__c: '2024-03-05', Tracking_Number__c: 'TRK345678', ShippingCity: 'Mumbai' },
    { Id: 'ORD004', AccountId: 'ACC001', OrderNumber: 'ORD-2024-004', Status: 'Pending', TotalAmount: 456000, EffectiveDate: '2024-03-01', DeliveryDate__c: null, Tracking_Number__c: null, ShippingCity: 'Mumbai' },
  ];

  const orderItems = [
    { Id: 'OI001', OrderId: 'ORD001', Product2Id: 'P001', Quantity: 2, UnitPrice: 45000, TotalPrice: 90000 },
    { Id: 'OI002', OrderId: 'ORD001', Product2Id: 'P003', Quantity: 3, UnitPrice: 12000, TotalPrice: 36000 },
    { Id: 'OI003', OrderId: 'ORD002', Product2Id: 'P002', Quantity: 3, UnitPrice: 78000, TotalPrice: 234000 },
    { Id: 'OI004', OrderId: 'ORD003', Product2Id: 'P004', Quantity: 22, UnitPrice: 3500, TotalPrice: 77000 },
    { Id: 'OI005', OrderId: 'ORD004', Product2Id: 'P006', Quantity: 3, UnitPrice: 125000, TotalPrice: 375000 },
    { Id: 'OI006', OrderId: 'ORD004', Product2Id: 'P005', Quantity: 3, UnitPrice: 28000, TotalPrice: 84000 },
  ];

  // Seed Dealer Inventory
  const dealerInventory = [
    { Id: 'INV001', Dealer__c: 'ACC001', Product2Id: 'P001', Product_Name__c: 'Industrial Pump X200', Stock_On_Hand__c: 15, Quantity__c: 15, Amount__c: 675000, Min_Stock_Level__c: 10, Last_Audit_Date__c: '2024-02-28' },
    { Id: 'INV002', Dealer__c: 'ACC001', Product2Id: 'P002', Product_Name__c: 'Hydraulic Motor HM500', Stock_On_Hand__c: 8, Quantity__c: 8, Amount__c: 624000, Min_Stock_Level__c: 5, Last_Audit_Date__c: '2024-02-28' },
    { Id: 'INV003', Dealer__c: 'ACC001', Product2Id: 'P003', Product_Name__c: 'Control Valve CV100', Stock_On_Hand__c: 42, Quantity__c: 42, Amount__c: 504000, Min_Stock_Level__c: 20, Last_Audit_Date__c: '2024-02-28' },
    { Id: 'INV004', Dealer__c: 'ACC001', Product2Id: 'P004', Product_Name__c: 'Pressure Gauge PG50', Stock_On_Hand__c: 4, Quantity__c: 4, Amount__c: 14000, Min_Stock_Level__c: 15, Last_Audit_Date__c: '2024-02-28' },
    { Id: 'INV005', Dealer__c: 'ACC001', Product2Id: 'P005', Product_Name__c: 'Filtration Unit FU300', Stock_On_Hand__c: 11, Quantity__c: 11, Amount__c: 308000, Min_Stock_Level__c: 8, Last_Audit_Date__c: '2024-02-28' },
    { Id: 'INV006', Dealer__c: 'ACC001', Product2Id: 'P006', Product_Name__c: 'Compressor CP750', Stock_On_Hand__c: 3, Quantity__c: 3, Amount__c: 375000, Min_Stock_Level__c: 5, Last_Audit_Date__c: '2024-02-28' },
  ];

  // Seed Dealer Schemes
  const dealerSchemes = [
    { Id: 'SCH001', Scheme_Name__c: 'Q1 2024 Volume Bonus', Discount_Percentage__c: 5, Min_Order_Value__c: 100000, Max_Order_Value__c: 500000, Start_Date__c: '2024-01-01', End_Date__c: '2024-03-31', IsActive__c: true },
    { Id: 'SCH002', Scheme_Name__c: 'Pumps & Motors Special', Discount_Percentage__c: 8, Min_Order_Value__c: 200000, Max_Order_Value__c: 1000000, Start_Date__c: '2024-02-01', End_Date__c: '2024-04-30', IsActive__c: true, Applicable_Category__c: 'Pumps' },
    { Id: 'SCH003', Scheme_Name__c: 'Gold Dealer Incentive', Discount_Percentage__c: 3, Min_Order_Value__c: 50000, Max_Order_Value__c: 999999999, Start_Date__c: '2024-01-01', End_Date__c: '2024-12-31', IsActive__c: true },
    { Id: 'SCH004', Scheme_Name__c: 'Mega Order Discount', Discount_Percentage__c: 12, Min_Order_Value__c: 500000, Max_Order_Value__c: 999999999, Start_Date__c: '2024-03-01', End_Date__c: '2024-05-31', IsActive__c: true },
  ];

  // Seed Warranty Registrations
  const warrantyRegs = [
    { Id: 'WR001', Dealer__c: 'ACC001', Customer_Name__c: 'Ravi Kumar', Product2Id: 'P001', Product_Name__c: 'Industrial Pump X200', Serial_Number__c: 'SN-IPX200-001', Purchase_Date__c: '2023-11-15', Warranty_Expiry__c: '2025-11-15', Status__c: 'Active', Claim_Date__c: null, Claim_Description__c: null },
    { Id: 'WR002', Dealer__c: 'ACC001', Customer_Name__c: 'Priya Sharma', Product2Id: 'P002', Product_Name__c: 'Hydraulic Motor HM500', Serial_Number__c: 'SN-HM500-002', Purchase_Date__c: '2023-12-01', Warranty_Expiry__c: '2025-12-01', Status__c: 'Claim Raised', Claim_Date__c: '2024-02-10', Claim_Description__c: 'Motor overheating issue' },
    { Id: 'WR003', Dealer__c: 'ACC001', Customer_Name__c: 'Arjun Mehta', Product2Id: 'P003', Product_Name__c: 'Control Valve CV100', Serial_Number__c: 'SN-CV100-003', Purchase_Date__c: '2024-01-05', Warranty_Expiry__c: '2026-01-05', Status__c: 'Active', Claim_Date__c: null, Claim_Description__c: null },
  ];

  // Seed Dealer Payments
  const dealerPayments = [
    { Id: 'PAY001', Dealer__c: 'ACC001', Invoice_Number__c: 'INV-2024-001', Amount__c: 135000, Due_Date__c: '2024-02-10', Payment_Date__c: '2024-02-08', Payment_Status__c: 'Paid', OrderId__c: 'ORD001', Type__c: 'Invoice' },
    { Id: 'PAY002', Dealer__c: 'ACC001', Invoice_Number__c: 'INV-2024-002', Amount__c: 234000, Due_Date__c: '2024-03-15', Payment_Date__c: null, Payment_Status__c: 'Pending', OrderId__c: 'ORD002', Type__c: 'Invoice' },
    { Id: 'PAY003', Dealer__c: 'ACC001', Invoice_Number__c: 'INV-2024-003', Amount__c: 78000, Due_Date__c: '2024-03-20', Payment_Date__c: null, Payment_Status__c: 'Overdue', OrderId__c: 'ORD003', Type__c: 'Invoice' },
    { Id: 'PAY004', Dealer__c: 'ACC001', Invoice_Number__c: 'CN-2024-001', Amount__c: -15000, Due_Date__c: '2024-02-28', Payment_Date__c: '2024-02-28', Payment_Status__c: 'Paid', OrderId__c: null, Type__c: 'Credit Note' },
  ];

  // Seed Cases
  const cases = [
    { Id: 'CASE001', AccountId: 'ACC001', CaseNumber: 'CS-2024-001', Subject: 'Delivery delay for ORD002', Status: 'In Progress', Priority: 'High', Description: 'Order placed on Feb 15 but tracking not updated', CreatedDate: '2024-02-25', LastModifiedDate: '2024-02-26', Resolution__c: null },
    { Id: 'CASE002', AccountId: 'ACC001', CaseNumber: 'CS-2024-002', Subject: 'Wrong product delivered in ORD001', Status: 'Closed', Priority: 'Medium', Description: 'Received CV100 instead of CV200', CreatedDate: '2024-01-22', LastModifiedDate: '2024-02-01', Resolution__c: 'Replacement shipped on Feb 1' },
    { Id: 'CASE003', AccountId: 'ACC001', CaseNumber: 'CS-2024-003', Subject: 'Invoice discrepancy for INV-2024-002', Status: 'Open', Priority: 'Low', Description: 'Scheme discount not applied on invoice', CreatedDate: '2024-03-01', LastModifiedDate: '2024-03-01', Resolution__c: null },
  ];

  // Seed Opportunities
  const opportunities = [
    { Id: 'OPP001', Name: 'Large Industrial Project - Phase 1', Dealer__c: 'ACC001', StageName: 'Proposal/Price Quote', Amount: 1500000, CloseDate: '2024-04-30', Probability: 60, Description: 'Bulk order for new plant setup' },
    { Id: 'OPP002', Name: 'Government Tender - Water Plant', Dealer__c: 'ACC001', StageName: 'Negotiation/Review', Amount: 3200000, CloseDate: '2024-05-15', Probability: 40, Description: 'State government water treatment plant' },
  ];

  sfDB.set('products', products).write();
  sfDB.set('pricebooks', pricebooks).write();
  sfDB.set('accounts', accounts).write();
  sfDB.set('orders', orders).write();
  sfDB.set('orderItems', orderItems).write();
  sfDB.set('dealerInventory', dealerInventory).write();
  sfDB.set('dealerSchemes', dealerSchemes).write();
  sfDB.set('warrantyRegs', warrantyRegs).write();
  sfDB.set('dealerPayments', dealerPayments).write();
  sfDB.set('cases', cases).write();
  sfDB.set('opportunities', opportunities).write();

  // Create default dealer user (skip if already exists)
  const bcrypt = require('bcryptjs');
  const existingUser = cacheDB.get('users').find({ email: 'dealer@sunrise.com' }).value();
  if (!existingUser) {
    const defaultUser = {
      _id: stableObjectId('USR001'),
      id: 'USR001',
      email: 'dealer@sunrise.com',
      password: bcrypt.hashSync('dealer123', 10),
      accountId: 'ACC001',
      role: 'dealer',
      name: 'Raj Sharma',
      createdAt: new Date().toISOString(),
    };
    cacheDB.get('users').push(defaultUser).write();
  }

  console.log('✅ Seed data written to Mock Salesforce Database');
  console.log('   Default Login: dealer@sunrise.com / dealer123');
}
