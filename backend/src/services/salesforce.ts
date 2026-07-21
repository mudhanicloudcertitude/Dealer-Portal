import { Connection } from 'jsforce';
import mongoose from 'mongoose';
import { CaseModel } from '../models/Case';

// ─── Singleton jsforce Connection ────────────────────────────────────────────
// One connection is created and reused across all API calls (no repeated logins)
let _conn: Connection | null = null;

// ─── getSFConnection ─────────────────────────────────────────────────────────
// Authenticates using ONLY username + password + security token.
// NO Connected App / client_id / client_secret needed.
// Uses jsforce SOAP login — the true "username-password flow".
export async function getSFConnection(): Promise<Connection> {

  // ── Reuse existing session if token is still present ──
  if (_conn && _conn.accessToken) {
    console.log('[SF] ♻️  Reusing existing Salesforce session');
    return _conn;
  }

  // ── Read credentials from environment ──
  const loginUrl = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';
  const username = process.env.SF_USERNAME;
  const password = process.env.SF_PASSWORD;
  const secToken = process.env.SF_SECURITY_TOKEN;

  // ── Debug: print config (passwords masked) ──
  console.log('[SF] 🔧 Connection config:');
  console.log(`[SF]    loginUrl  : ${loginUrl}`);
  console.log(`[SF]    username  : ${username}`);
  console.log(`[SF]    password  : ${password ? '***' + password.slice(-3) : '⛔ MISSING'}`);
  console.log(`[SF]    secToken  : ${secToken ? '***' + secToken.slice(-4) : '⛔ MISSING'}`);

  if (!username || !password || !secToken) {
    const missing = [
      !username ? 'SF_USERNAME' : null,
      !password ? 'SF_PASSWORD' : null,
      !secToken ? 'SF_SECURITY_TOKEN' : null,
    ].filter(Boolean).join(', ');
    throw new Error(`[SF] Missing env variables: ${missing}`);
  }

  // ── Create jsforce Connection (SOAP-based, no OAuth / Connected App) ──
  console.log('[SF] 🔌 Creating jsforce.Connection...');
  _conn = new Connection({
    loginUrl,
    version: (process.env.SF_API_VERSION || 'v59.0').replace('v', ''),
  });

  // ── Login: password MUST be password + securityToken (no space) ──
  // SF docs: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_calls_login.htm
  const fullPassword = `${password}${secToken}`;

  console.log('[SF] 🚀 Calling conn.login() (SOAP Username-Password)...');
  console.log(`[SF]    Endpoint: ${loginUrl}/services/Soap/u/${(_conn as any).version}`);

  try {
    const userInfo = await _conn.login(username, fullPassword);

    console.log('[SF] ✅ Salesforce login SUCCESSFUL!');
    console.log(`[SF]    SF User ID        : ${userInfo.id}`);
    console.log(`[SF]    SF Org ID         : ${userInfo.organizationId}`);
    console.log(`[SF]    Instance URL      : ${_conn.instanceUrl}`);
    console.log(`[SF]    API Version       : ${(_conn as any).version}`);
    console.log(`[SF]    Access Token (12) : ${_conn.accessToken?.slice(0, 12)}...`);

    return _conn;
  } catch (err: any) {
    _conn = null; // Clear broken connection — next call will retry fresh
    console.error('[SF] ❌ Login FAILED!');
    console.error(`[SF]    Error Code : ${err.errorCode || 'N/A'}`);
    console.error(`[SF]    Message    : ${err.message}`);

    // Give a specific, actionable hint for the most common error
    if (err.message?.includes('SOAP API login() is disabled')) {
      console.error('[SF] 💡 FIX: Go to SF Setup → Identity → OAuth and OpenID Connect Settings');
      console.error('[SF]         → Enable "Allow SOAP API Authentication" or toggle "SOAP Login" ON');
    }
    if (err.message?.includes('INVALID_LOGIN')) {
      console.error('[SF] 💡 FIX: Check SF_USERNAME, SF_PASSWORD, and SF_SECURITY_TOKEN in .env');
      console.error('[SF]         → Reset Security Token: SF Setup → My Profile → Reset Security Token');
    }

    throw new Error(`Salesforce login failed: ${err.message}`);
  }
}

// ─── createDealerAccount ─────────────────────────────────────────────────────
// Creates a Dealer Account in Salesforce.
// Maps: MongoDB UserId → UserId__c custom field on Account.
export async function createDealerAccount(data: {
  name  : string;
  phone : string;
  city  : string;
  state : string;
  userId: string; // MongoDB User ID → stored in SF custom field UserId__c
}): Promise<string> {

  console.log(`\n[SF] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`[SF] 📋 createDealerAccount()`);
  console.log(`[SF]    name       : ${data.name}`);
  console.log(`[SF]    phone      : ${data.phone}`);
  console.log(`[SF]    city       : ${data.city}`);
  console.log(`[SF]    state      : ${data.state}`);
  console.log(`[SF]    userId(MDB): ${data.userId}`);

  // ── Step 1: Get authenticated connection ──
  const conn = await getSFConnection();

  // ── Step 2: Dynamically fetch the "Dealer" RecordType ID via SOQL ──
  // Never hardcode RecordTypeId — it changes per org
  let recordTypeId: string | undefined;
  try {
    console.log(`[SF] 🔍 Querying RecordType: SELECT Id FROM RecordType WHERE SobjectType='Account' AND DeveloperName='Dealer'`);
    const rtResult = await conn.query<{ Id: string }>(
      "SELECT Id FROM RecordType WHERE SobjectType='Account' AND DeveloperName='Dealer' LIMIT 1"
    );
    if (rtResult.records.length > 0) {
      recordTypeId = rtResult.records[0].Id;
      console.log(`[SF] ✅ RecordType "Dealer" ID: ${recordTypeId}`);
    } else {
      console.warn(`[SF] ⚠️  No RecordType with DeveloperName="Dealer" found on Account`);
      console.warn(`[SF]    → Account will be created without RecordTypeId`);
    }
  } catch (rtErr: any) {
    if (rtErr.errorCode === 'INVALID_SESSION_ID') {
      _conn = null; // Invalidate so next call re-authenticates
      console.warn('[SF] ⚠️  Session expired during RecordType query. Cache cleared.');
    }
    console.warn(`[SF] ⚠️  RecordType query failed (non-fatal): ${rtErr.message}`);
  }

  // ── Step 3: Build Account payload ──
  const payload: Record<string, any> = {
    Name           : data.name,
    Phone          : data.phone,
    Dealer_City__c : data.city,
    Dealer_State__c: data.state,
    UserId__c      : data.userId,  // MongoDB User ID → Salesforce custom field
  };
  if (recordTypeId) payload.RecordTypeId = recordTypeId;

  console.log('[SF] 📦 Payload to create:');
  Object.entries(payload).forEach(([k, v]) => console.log(`[SF]    ${k.padEnd(14)}: ${v}`));

  // ── Step 4: Create Account in Salesforce ──
  try {
    console.log(`[SF] 🚀 conn.sobject('Account').create() ...`);
    const result = await conn.sobject('Account').create(payload);

    if (!(result as any).success) {
      const errors = JSON.stringify((result as any).errors || []);
      console.error(`[SF] ❌ Account creation returned success=false`);
      console.error(`[SF]    Errors: ${errors}`);
      throw new Error(`SF Account creation failed: ${errors}`);
    }

    const sfId = (result as any).id as string;
    console.log(`[SF] ✅ Account CREATED in Salesforce!`);
    console.log(`[SF]    SF Account ID : ${sfId}`);
    console.log(`[SF]    View at       : ${conn.instanceUrl}/${sfId}`);
    console.log(`[SF] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return sfId;

  } catch (createErr: any) {
    if (createErr.errorCode === 'INVALID_SESSION_ID') {
      _conn = null;
      console.warn('[SF] ⚠️  Session expired during Account create. Cache cleared for retry.');
    }
    console.error(`[SF] ❌ sobject('Account').create() failed: ${createErr.message}`);
    throw createErr;
  }
}

// ─── syncAccountFromSF ────────────────────────────────────────────────────────
// Fetches the latest Account details from real Salesforce and updates the local db cache.
export async function syncAccountFromSF(sfAccountId: string): Promise<any> {
  console.log(`\n[SF] 🔄 syncAccountFromSF() triggered for Account ID: ${sfAccountId}`);
  
  if (!sfAccountId || sfAccountId.startsWith('ACC')) {
    console.log(`[SF] ℹ️ Skipping real-time sync for mock Account ID: ${sfAccountId}`);
    return null;
  }

  try {
    const conn = await getSFConnection();
    
    // Attempt to query standard fields and common custom fields
    const possibleFields = [
      'Id',
      'Name',
      'Phone',
      'Dealer_City__c',
      'Dealer_State__c',
      'UserId__c',
      'Dealer_ID__c',
      'Credit_Limit__c',
      'Outstanding_Amount__c',
      'Status__c',
      'Tier__c',
      'Join_Date__c'
    ];

    let record: any = null;
    
    try {
      const fieldsToQuery = possibleFields.join(', ');
      console.log(`[SF] 🔍 Executing SOQL: SELECT ${fieldsToQuery} FROM Account WHERE Id = '${sfAccountId}' LIMIT 1`);
      const result = await conn.query<any>(
        `SELECT ${fieldsToQuery} FROM Account WHERE Id = '${sfAccountId}' LIMIT 1`
      );
      if (result.records && result.records.length > 0) {
        record = result.records[0];
      }
    } catch (err: any) {
      console.warn(`[SF] ⚠️ SOQL with custom fields failed: ${err.message}`);
      
      // Fallback: Query only standard fields + UserId__c
      const fallbackFields = ['Id', 'Name', 'Phone', 'Dealer_City__c', 'Dealer_State__c', 'UserId__c'];
      console.log(`[SF] 🔄 Trying fallback SOQL with standard fields: ${fallbackFields.join(', ')}`);
      
      const result = await conn.query<any>(
        `SELECT ${fallbackFields.join(', ')} FROM Account WHERE Id = '${sfAccountId}' LIMIT 1`
      );
      if (result.records && result.records.length > 0) {
        record = result.records[0];
      }
    }

    if (!record) {
      console.warn(`[SF] ⚠️ No Account record found in Salesforce for ID: ${sfAccountId}`);
      return null;
    }

    console.log('[SF] ✅ Account details retrieved from real Salesforce:', JSON.stringify(record, null, 2));

    // Map Salesforce fields to local database structure
    const mappedAccount = {
      Id: record.Id,
      Name: record.Name,
      Phone: record.Phone || '',
      City__c: record.Dealer_City__c || '',
      State__c: record.Dealer_State__c || '',
      Email__c: record.Email__c || '',
      UserId__c: record.UserId__c || '',
      Dealer_ID__c: record.Dealer_ID__c || `DLR-${record.Id.slice(-4).toUpperCase()}`,
      RecordType: 'Dealer',
      Credit_Limit__c: Number(record.Credit_Limit__c) || 1000000,
      Outstanding_Amount__c: Number(record.Outstanding_Amount__c) || 0,
      Status__c: record.Status__c || 'Active',
      Tier__c: record.Tier__c || 'Bronze',
      Join_Date__c: record.Join_Date__c || new Date().toISOString().split('T')[0],
    };

    // Update or insert in local lowdb (sfDB)
    const { sfDB } = require('../db/init');
    const existing = sfDB.get('accounts').find({ Id: record.Id }).value();
    if (existing) {
      sfDB.get('accounts').find({ Id: record.Id }).assign(mappedAccount).write();
      console.log(`[SF] 💾 Updated cached Account in sfDB: ${record.Id}`);
    } else {
      sfDB.get('accounts').push(mappedAccount).write();
      console.log(`[SF] 💾 Inserted new Account in sfDB: ${record.Id}`);
    }

    console.log(`[SF] 🔄 syncAccountFromSF() completed successfully!`);
    return mappedAccount;
  } catch (err: any) {
    console.error(`[SF] ❌ syncAccountFromSF() failed: ${err.message}`);
    throw err;
  }
}

// ─── syncCasesFromSF ─────────────────────────────────────────────────────────
// Syncs Salesforce Cases for a specific Account to MongoDB.
export async function syncCasesFromSF(sfAccountId: string, mongoUserId: any): Promise<void> {
  console.log(`\n[SF] 🔄 syncCasesFromSF() triggered for Account ID: ${sfAccountId}`);
  
  if (!sfAccountId || sfAccountId.startsWith('ACC')) {
    console.log(`[SF] ℹ️ Using mock cases for Account ID: ${sfAccountId}`);
    const { hydrateMockDataForAccount } = require('../db/mockHydrate');
    await hydrateMockDataForAccount(sfAccountId, mongoUserId);
    return;
  }

  try {
    const conn = await getSFConnection();
    
    console.log(`[SF] 🔍 Fetching Cases from Salesforce for Account ID: ${sfAccountId}...`);
    const result = await conn.query<any>(
      `SELECT Id, CaseNumber, Subject, Status, Priority, Description, CreatedDate, LastModifiedDate, Resolution_Details__c 
       FROM Case 
       WHERE AccountId = '${sfAccountId}' 
       ORDER BY CreatedDate DESC`
    );

    console.log(`[SF] ✅ Retrieved ${result.records.length} Cases from Salesforce`);

    for (const record of result.records) {
      // Map dates to standard YYYY-MM-DD format
      const createdDate = record.CreatedDate ? record.CreatedDate.split('T')[0] : new Date().toISOString().split('T')[0];
      const modifiedDate = record.LastModifiedDate ? record.LastModifiedDate.split('T')[0] : new Date().toISOString().split('T')[0];

      await CaseModel.findOneAndUpdate(
        { sfId: record.Id },
        {
          user: mongoUserId,
          accountId: sfAccountId,
          sfId: record.Id,
          CaseNumber: record.CaseNumber,
          Subject: record.Subject || '',
          Description: record.Description || '',
          Priority: record.Priority || 'Medium',
          Status: record.Status || 'New',
          CreatedDate: createdDate,
          LastModifiedDate: modifiedDate,
          Resolution__c: record.Resolution_Details__c || null,
        },
        { upsert: true, new: true }
      );
      console.log(`[SF] 💾 Upserted Case ${record.CaseNumber} to MongoDB`);
    }

    console.log(`[SF] 🔄 syncCasesFromSF() completed successfully!`);
  } catch (err: any) {
    console.error(`[SF] ❌ syncCasesFromSF() failed: ${err.message}`);
    throw err;
  }
}

// ─── createSFCase ────────────────────────────────────────────────────────────
// Creates a Case in Salesforce and retrieves its system-generated CaseNumber.
export async function createSFCase(data: {
  subject: string;
  description: string;
  priority: string;
  accountId: string;
  customerName?: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  orderId?: string | null;
}): Promise<{ id: string; caseNumber?: string }> {
  if (data.accountId?.startsWith('ACC')) {
    const id = `MOCK_CASE_${Date.now()}`;
    return { id, caseNumber: `CS-MOCK-${String(Date.now()).slice(-6)}` };
  }

  const conn = await getSFConnection();

  // Build enriched description including customer context
  const customerContext = [
    `Customer: ${data.customerName || 'N/A'}`,
    data.customerEmail ? `Email: ${data.customerEmail}` : null,
    data.customerPhone ? `Phone: ${data.customerPhone}` : null,
    data.orderId ? `Order ID: ${data.orderId}` : null,
  ].filter(Boolean).join(' | ');

  const enrichedDescription = `${customerContext}\n\n${data.description || ''}`.trim();

  const payload: Record<string, any> = {
    AccountId: data.accountId,
    Subject: data.subject,
    Description: enrichedDescription,
    Priority: data.priority,
    Status: 'New',
    Origin: 'Dealer Portal',
  };

  // Try to set SuppliedName, SuppliedEmail, SuppliedPhone if customer info is provided
  if (data.customerName) payload.SuppliedName = data.customerName;
  if (data.customerEmail) payload.SuppliedEmail = data.customerEmail;
  if (data.customerPhone) payload.SuppliedPhone = data.customerPhone;

  const result = await conn.sobject('Case').create(payload);

  if (!result.success) {
    throw new Error(JSON.stringify(result.errors || []));
  }

  const id = result.id;
  let caseNumber: string | undefined;

  try {
    const fetched = await conn.sobject('Case').retrieve(id);
    if (fetched && (fetched as any).CaseNumber) {
      caseNumber = (fetched as any).CaseNumber;
    }
  } catch (err) {
    console.warn(`[SF] ⚠️ Failed to retrieve generated CaseNumber from SF:`, err);
  }

  return { id, caseNumber };
}

// ─── closeSFCase ─────────────────────────────────────────────────────────────
// Marks a Salesforce Case as Closed.
export async function closeSFCase(sfId: string): Promise<void> {
  const conn = await getSFConnection();
  const result = await conn.sobject('Case').update({
    Id: sfId,
    Status: 'Closed',
  });

  if (!result.success) {
    throw new Error(JSON.stringify(result.errors || []));
  }
}

// ─── syncProductsFromSF ───────────────────────────────────────────────────────────
// Fetches live Products and their pricing from Salesforce Standard Pricebook.
export async function syncProductsFromSF(): Promise<any[]> {
  console.log('\n[SF] 🔄 syncProductsFromSF() triggered');
  try {
    const conn = await getSFConnection();
    
    let records: any[] = [];
    try {
      console.log('[SF] 🔍 Executing SOQL for PricebookEntry with Pricebook2.IsStandard = true...');
      const result = await conn.query<any>(
        `SELECT Id, UnitPrice, Product2Id, Pricebook2Id,
                Product2.Id, Product2.Name, Product2.ProductCode, Product2.Family, Product2.Description, Product2.IsActive, Product2.StockKeepingUnit
         FROM PricebookEntry 
         WHERE Pricebook2.IsStandard = true AND IsActive = true AND Product2.IsActive = true`
      );
      records = result.records;
    } catch (queryErr: any) {
      console.warn(`[SF] ⚠️ Query with IsStandard filter failed: ${queryErr.message}`);
      console.log('[SF] 🔄 Trying fallback query without IsStandard filter...');
      try {
        const result = await conn.query<any>(
          `SELECT Id, UnitPrice, Product2Id, Pricebook2Id,
                  Product2.Id, Product2.Name, Product2.ProductCode, Product2.Family, Product2.Description, Product2.IsActive, Product2.StockKeepingUnit
           FROM PricebookEntry 
           WHERE IsActive = true AND Product2.IsActive = true`
        );
        records = result.records;
      } catch (fallbackErr: any) {
        console.error(`[SF] ❌ Fallback query failed: ${fallbackErr.message}`);
        throw fallbackErr;
      }
    }

    console.log(`[SF] ✅ Retrieved ${records.length} PricebookEntry records from Salesforce`);

    const mappedProducts = records.map((record: any) => {
      const p2 = record.Product2 || {};
      return {
        Id: p2.Id || record.Product2Id,
        Name: p2.Name || 'Unnamed Product',
        ProductCode: p2.ProductCode || record.Id,
        Family: p2.Family || 'General',
        Description: p2.Description || '',
        IsActive: p2.IsActive ?? true,
        StockKeepingUnit: p2.StockKeepingUnit || p2.ProductCode || '',
        UnitPrice: Number(record.UnitPrice) || 0,
        ListPrice: Number(record.UnitPrice) || 0,
        Forecasted_Demand__c: Number(record.Forecasted_Demand__c) || Math.floor(Math.random() * 200) + 50,
        Restock_Recommendation__c: Number(record.Restock_Recommendation__c) || Math.floor(Math.random() * 80) + 20,
      };
    });

    // Update the local cache (portal_cache.json) via cacheDB
    const { cacheDB } = require('../db/init');
    cacheDB.set('cachedProducts', mappedProducts).write();
    console.log(`[SF] 💾 Cached ${mappedProducts.length} products to local lowdb`);

    // Upsert products into MongoDB database
    try {
      const { ProductModel } = require('../models/Product');
      for (const prod of mappedProducts) {
        await ProductModel.findOneAndUpdate(
          { Id: prod.Id },
          prod,
          { upsert: true, new: true }
        );
      }
      console.log(`[SF] 💾 Upserted ${mappedProducts.length} products to MongoDB`);
    } catch (dbErr: any) {
      console.warn(`[SF] ⚠️ Failed to save products to MongoDB, relying on cache fallback: ${dbErr.message}`);
    }

    return mappedProducts;
  } catch (err: any) {
    console.error(`[SF] ❌ syncProductsFromSF() failed: ${err.message}`);
    throw err;
  }
}

// ─── syncInventoryFromSF ──────────────────────────────────────────────────────
// Syncs Dealer_Inventory__c records from Salesforce using the new object structure.
// SOQL: SELECT Id, Inventory__r.Product__c, Inventory__r.Product__r.Name, Quantity__c, Dealer__c
//       FROM Dealer_Inventory__c WHERE Dealer__c = '<sfAccountId>'
export async function syncInventoryFromSF(sfAccountId: string, mongoUserId: any): Promise<any[]> {
  console.log(`\n[SF] 🔄 syncInventoryFromSF() triggered for Account: ${sfAccountId}`);

  if (!sfAccountId || sfAccountId.startsWith('ACC')) {
    console.log(`[SF] ℹ️ Skipping real-time inventory sync for mock Account ID: ${sfAccountId}`);
    const { InventoryModel } = require('../models/Inventory');
    return await InventoryModel.find({ user: mongoUserId });
  }

  try {
    const conn = await getSFConnection();

    const soql = `SELECT Id, Inventory__r.Product__c, Inventory__r.Product__r.Name, Quantity__c, Dealer__c, Amount__c
                  FROM Dealer_Inventory__c
                  WHERE Dealer__c = '${sfAccountId}'
                  ORDER BY Inventory__r.Product__r.Name ASC`;

    console.log(`[SF] 🔍 SOQL: ${soql.trim()}`);
    const result = await conn.query<any>(soql);
    console.log(`[SF] ✅ Retrieved ${result.records.length} Dealer_Inventory__c records`);

    const { InventoryModel } = require('../models/Inventory');
    const { ProductModel } = require('../models/Product');
    const synced: any[] = [];

    for (const record of result.records) {
      const product2Id: string = record.Inventory__r?.Product__c || '';
      const productName: string = record.Inventory__r?.Product__r?.Name || 'Unknown Product';
      const quantity: number = Number(record.Quantity__c) || 0;
      const amount: number = Number(record.Amount__c) || 0;

      // Find or resolve local MongoDB Product
      let localProduct = product2Id ? await ProductModel.findOne({ Id: product2Id }) : null;

      if (!localProduct) {
        console.warn(`[SF] ⚠️ No local product found for Product2Id: ${product2Id} — skipping record`);
        continue;
      }

      const doc = await InventoryModel.findOneAndUpdate(
        { user: mongoUserId, Product: localProduct._id },
        {
          user: mongoUserId,
          accountId: sfAccountId,
          sfId: record.Id,
          Product: localProduct._id,
          Product2Id: product2Id,
          Product_Name__c: productName,
          Quantity__c: quantity,
          Amount__c: amount,
        },
        { upsert: true, new: true }
      );

      synced.push(doc);
      console.log(`[SF] 💾 Upserted inventory record: ${productName} → ${quantity} units, Amount: ${amount}`);
    }

    console.log(`[SF] 🔄 syncInventoryFromSF() completed. Synced ${synced.length} records.`);
    return synced;
  } catch (err: any) {
    console.error(`[SF] ❌ syncInventoryFromSF() failed, falling back to local: ${err.message}`);
    const { InventoryModel } = require('../models/Inventory');
    return await InventoryModel.find({ user: mongoUserId });
  }
}

// ─── syncOrdersFromSF ────────────────────────────────────────────────────────
// Syncs custom Dealer_Order__c records from Salesforce for a given Account.
export async function syncOrdersFromSF(sfAccountId: string, mongoUserId: any): Promise<any[]> {
  console.log(`\n[SF] 🔄 syncOrdersFromSF() triggered for Account ID: ${sfAccountId}`);
  if (!sfAccountId || sfAccountId.startsWith('ACC')) {
    console.log(`[SF] ℹ️ Using mock data for Account ID: ${sfAccountId}`);
    const { hydrateMockDataForAccount } = require('../db/mockHydrate');
    await hydrateMockDataForAccount(sfAccountId, mongoUserId);
    const { OrderModel } = require('../models/Order');
    return await OrderModel.find({ user: mongoUserId });
  }

  try {
    const conn = await getSFConnection();
    
    console.log(`[SF] 🔍 Fetching Dealer Orders from Salesforce for Account ID: ${sfAccountId}...`);
    const result = await conn.query<any>(
      `SELECT Id, Name, Account__c, Product__c, Product__r.Name, Product__r.ProductCode, 
              Quantity__c, UnitPrice__c, TotalAmount__c, Status__c, Tracking_Number__c, 
              Delivery_Date__c, Shipping_Address__c, Portal_User_Id__c, Applied_Scheme__c, 
              Discount_Amount__c, CreatedDate
       FROM Dealer_Order__c 
       WHERE Account__c = '${sfAccountId}' 
       ORDER BY CreatedDate DESC`
    );

    console.log(`[SF] ✅ Retrieved ${result.records.length} Dealer Orders from Salesforce`);

    const { OrderModel } = require('../models/Order');
    const { ProductModel } = require('../models/Product');
    const syncedOrders: any[] = [];

    for (const record of result.records) {
      // Find local product reference
      const localProduct = await ProductModel.findOne({ Id: record.Product__c });
      
      const createdDateStr = record.CreatedDate ? record.CreatedDate.split('T')[0] : new Date().toISOString().split('T')[0];
      const deliveryDateStr = record.Delivery_Date__c || null;

      // Check if transitioning to Delivered to credit inventory
      const existing = await OrderModel.findOne({ sfId: record.Id });
      let inventoryCredited = existing?.InventoryCredited || false;

      if (record.Status__c === 'Delivered' && !inventoryCredited) {
        const { creditLocalInventory } = require('../models/Inventory');
        try {
          await creditLocalInventory({
            userId: mongoUserId,
            accountId: sfAccountId,
            productId: localProduct ? localProduct._id : new mongoose.Types.ObjectId(),
            product2Id: record.Product__c,
            productName: record.Product__r?.Name || 'Unknown Product',
            quantity: Number(record.Quantity__c) || 0
          });
          inventoryCredited = true;
        } catch (err: any) {
          console.error('[SYNC] Failed to credit inventory for delivered order:', err.message);
        }
      }

      const orderData = {
        user: mongoUserId,
        accountId: sfAccountId,
        sfId: record.Id,
        OrderNumber: record.Name,
        Product: localProduct ? localProduct._id : new mongoose.Types.ObjectId(),
        ProductName: record.Product__r?.Name || 'Unknown Product',
        ProductCode: record.Product__r?.ProductCode || 'N/A',
        Quantity: Number(record.Quantity__c) || 0,
        UnitPrice: Number(record.UnitPrice__c) || 0,
        TotalAmount: Number(record.TotalAmount__c) || 0,
        Status: record.Status__c || 'Pending',
        TrackingNumber: record.Tracking_Number__c || '',
        DeliveryDate: deliveryDateStr,
        ShippingCity: record.Shipping_Address__c || 'Mumbai',
        AppliedScheme: record.Applied_Scheme__c || '',
        DiscountAmount: Number(record.Discount_Amount__c) || 0,
        InventoryCredited: inventoryCredited,
        CreatedDate: createdDateStr,
      };

      const doc = await OrderModel.findOneAndUpdate(
        { sfId: record.Id },
        orderData,
        { upsert: true, new: true }
      );
      syncedOrders.push(doc);
    }

    // Refresh the lowdb cache for consistent rendering
    const { cacheDB } = require('../db/init');
    const enrichedCachedOrders = syncedOrders.map(o => {
      const plainObj = o.toObject ? o.toObject() : { ...o };
      plainObj.Id = plainObj.sfId || plainObj._id.toString();
      // Emulate the frontend expected "items" array for backward compatibility
      plainObj.items = [{
        Product2Id: plainObj.Product?.toString(),
        ProductName: plainObj.ProductName,
        ProductCode: plainObj.ProductCode,
        Quantity: plainObj.Quantity,
        UnitPrice: plainObj.UnitPrice,
        TotalPrice: plainObj.TotalAmount
      }];
      plainObj.AppliedScheme = plainObj.AppliedScheme || '';
      plainObj.DiscountAmount = plainObj.DiscountAmount || 0;
      return plainObj;
    });
    
    // Merge or set in cacheDB
    cacheDB.set('cachedOrders', enrichedCachedOrders).write();
    console.log(`[SF] 💾 Synced and cached ${enrichedCachedOrders.length} orders in local lowdb`);

    return syncedOrders;
  } catch (err: any) {
    console.error(`[SF] ❌ syncOrdersFromSF() failed: ${err.message}`);
    throw err;
  }
}

// ─── createSFOrder ───────────────────────────────────────────────────────────
// Creates a Dealer_Order__c in Salesforce with customer details and product info.
export async function createSFOrder(data: {
  accountId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  shippingCity: string;
  userId: string;
  appliedScheme?: string;
  discountAmount?: number;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  customerPhone?: string;
}): Promise<{ id: string; name: string }> {
  console.log('[SF] 🚀 Creating Dealer Order in Salesforce...');
  const conn = await getSFConnection();

  const payload: Record<string, any> = {
    Account__c: data.accountId,
    Product__c: data.productId,
    Quantity__c: data.quantity,
    UnitPrice__c: data.unitPrice,
    TotalAmount__c: data.totalAmount,
    Status__c: 'Pending',
    Shipping_Address__c: data.shippingCity,
    Portal_User_Id__c: data.userId,
    Applied_Scheme__c: data.appliedScheme || '',
    Discount_Amount__c: data.discountAmount || 0,
  };

  // Add customer fields if provided
  if (data.customerFirstName) payload.Customer_First_Name__c = data.customerFirstName;
  if (data.customerLastName) payload.Customer_Last_Name__c = data.customerLastName;
  if (data.customerEmail) payload.Customer_Email__c = data.customerEmail;
  if (data.customerPhone) payload.Customer_Phone__c = data.customerPhone;

  const result = await conn.sobject('Dealer_Order__c').create(payload);

  if (!result.success) {
    throw new Error(JSON.stringify(result.errors || []));
  }

  // Retrieve the auto-generated Name (OrderReference)
  const fetched = await conn.sobject('Dealer_Order__c').retrieve(result.id);

  return {
    id: result.id,
    name: (fetched as any).Name || 'ORD-UNKNOWN'
  };
}

// ─── cancelSFOrder ───────────────────────────────────────────────────────────
// Cancels a direct B2B Dealer Order in Salesforce.
export async function cancelSFOrder(sfOrderId: string): Promise<void> {
  console.log(`[SF] 🚀 Cancelling Dealer Order in Salesforce: ${sfOrderId}`);
  const conn = await getSFConnection();
  
  const result = await conn.sobject('Dealer_Order__c').update({
    Id: sfOrderId,
    Status__c: 'Cancelled'
  });

  if (!result.success) {
    throw new Error(JSON.stringify(result.errors || []));
  }
}

// ─── syncSchemesFromSF ───────────────────────────────────────────────────────
// Syncs active Dealer_Scheme__c records from Salesforce.
export async function syncSchemesFromSF(): Promise<any[]> {
  console.log('\n[SF] 🔄 syncSchemesFromSF() triggered');
  try {
    const conn = await getSFConnection();
    console.log('[SF] 🔍 Fetching Dealer Schemes from Salesforce...');
    const result = await conn.query<any>(
      `SELECT Id, Name, Discount_Percentage__c, Min_Order_Value__c, Max_Order_Value__c, CreatedDate, IsActive__c, End_Date__c 
       FROM Dealer_Scheme__c 
       ORDER BY Min_Order_Value__c ASC`
    );
    
    console.log(`[SF] ✅ Retrieved ${result.records.length} Dealer Schemes from Salesforce`);
    
    const mappedSchemes = result.records.map((r: any) => ({
      Id: r.Id,
      Scheme_Name__c: r.Name, // Map standard Name field to Scheme_Name__c for portal compatibility
      Discount_Percentage__c: Number(r.Discount_Percentage__c) || 0,
      Min_Order_Value__c: Number(r.Min_Order_Value__c) || 0,
      Max_Order_Value__c: r.Max_Order_Value__c !== null && r.Max_Order_Value__c !== undefined ? Number(r.Max_Order_Value__c) : 999999999,
      IsActive__c: r.IsActive__c ?? true,
      End_Date__c: r.End_Date__c || null,
      Start_Date__c: r.CreatedDate ? r.CreatedDate.split('T')[0] : new Date().toISOString().split('T')[0]
    }));

    const { sfDB } = require('../db/init');
    sfDB.set('dealerSchemes', mappedSchemes).write();
    console.log(`[SF] 💾 Cached ${mappedSchemes.length} schemes in lowdb`);
    
    return mappedSchemes;
  } catch (err: any) {
    console.warn(`[SF] ⚠️ syncSchemesFromSF() query failed, falling back to cached schemes: ${err.message}`);
    const { sfDB } = require('../db/init');
    return sfDB.get('dealerSchemes').value() || [];
  }
}

// ─── syncInvoicesFromSF ───────────────────────────────────────────────────────
// Syncs custom Dealer_Invoice__c records from Salesforce to MongoDB.
export async function syncInvoicesFromSF(sfAccountId: string, mongoUserId: any): Promise<any[]> {
  console.log(`\n[SF] 🔄 syncInvoicesFromSF() triggered for Account ID: ${sfAccountId}`);
  const { InvoiceModel } = require('../models/Invoice');

  if (!sfAccountId || sfAccountId.startsWith('ACC')) {
    console.log(`[SF] ℹ️ Skipping real-time invoice sync for mock Account ID: ${sfAccountId}`);
    return await InvoiceModel.find({ user: mongoUserId }).sort({ CreatedDate: -1 });
  }

  try {
    const conn = await getSFConnection();
    console.log(`[SF] 🔍 Fetching Dealer Invoices from Salesforce for Account ID: ${sfAccountId}...`);
    const result = await conn.query<any>(
      `SELECT Id, Name, Account__c, Order__c, Amount__c, Due_Date__c, Payment_Date__c, Payment_Status__c, Bank_Details__c 
       FROM Dealer_Invoice__c 
       WHERE Account__c = '${sfAccountId}' 
       ORDER BY CreatedDate DESC`
    );

    console.log(`[SF] ✅ Retrieved ${result.records.length} Dealer Invoices from Salesforce`);
    const synced: any[] = [];

    for (const record of result.records) {
      let status = record.Payment_Status__c || 'Pending';
      if (status === 'Paid') status = 'Completed';
      if (status === 'Overdue') status = 'On Hold';

      const invData = {
        user: mongoUserId,
        accountId: sfAccountId,
        sfId: record.Id,
        InvoiceNumber: record.Name,
        OrderId: record.Order__c,
        Amount: Number(record.Amount__c) || 0,
        DueDate: record.Due_Date__c,
        PaymentDate: record.Payment_Date__c || null,
        Status: status,
        BankDetails: record.Bank_Details__c || null,
      };

      const doc = await InvoiceModel.findOneAndUpdate(
        { sfId: record.Id },
        invData,
        { upsert: true, new: true }
      );
      synced.push(doc);
    }

    return synced;
  } catch (err: any) {
    console.error(`[SF] ❌ syncInvoicesFromSF() failed, falling back to local: ${err.message}`);
    return await InvoiceModel.find({ user: mongoUserId }).sort({ CreatedDate: -1 });
  }
}

// ─── paySFInvoice ────────────────────────────────────────────────────────────
// Clears a B2B invoice in Salesforce, logs bank details, and reconciles credit limits.
export async function paySFInvoice(sfInvoiceId: string, bankDetails: string): Promise<void> {
  console.log(`[SF] 🚀 paySFInvoice() triggered for Invoice ID: ${sfInvoiceId}`);
  const conn = await getSFConnection();
  const today = new Date().toISOString().split('T')[0];

  // 1. Update Invoice in Salesforce
  await conn.sobject('Dealer_Invoice__c').update({
    Id: sfInvoiceId,
    Payment_Status__c: 'Paid',
    Payment_Date__c: today,
    Bank_Details__c: bankDetails
  });
  console.log(`[SF] ✅ Marked Invoice ${sfInvoiceId} as Completed in Salesforce`);

  // 2. Fetch invoice to reconcile Account outstanding balance
  const inv = await conn.sobject('Dealer_Invoice__c').retrieve(sfInvoiceId);
  const accountId = (inv as any).Account__c;
  const amount = Number((inv as any).Amount__c) || 0;

  if (accountId) {
    try {
      console.log(`[SF] 🔄 Reconciling outstanding credit for Account ${accountId}...`);
      const account = await conn.sobject('Account').retrieve(accountId);
      const currentOutstanding = Number((account as any).Outstanding_Amount__c) || 0;
      const nextOutstanding = Math.max(0, currentOutstanding - amount);
      
      await conn.sobject('Account').update({
        Id: accountId,
        Outstanding_Amount__c: nextOutstanding
      });
      console.log(`[SF] ✅ Reconciled Account outstanding balance. Previous: ${currentOutstanding}, New: ${nextOutstanding}`);
    } catch (accErr: any) {
      console.error(`[SF] ⚠️ Failed to update Account outstanding balance:`, accErr.message);
    }
  }
}

// ─── searchSFInvoices ─────────────────────────────────────────────────────────
// Searches Dealer_Invoice__c records by customer name and/or order ID.
export async function searchSFInvoices(data: {
  accountId: string;
  customerName: string;
  orderId: string;
}): Promise<any[]> {
  console.log(`[SF] 🔍 searchSFInvoices() — name: "${data.customerName}", orderId: "${data.orderId}"`);

  if (data.accountId?.startsWith('ACC')) {
    const { sfDB } = require('../db/init');
    let payments = sfDB.get('dealerPayments').filter({ Dealer__c: data.accountId }).value() || [];
    if (data.orderId) {
      const q = data.orderId.toLowerCase();
      payments = payments.filter((p: any) =>
        (p.OrderId__c || '').toLowerCase().includes(q) ||
        (p.Invoice_Number__c || '').toLowerCase().includes(q)
      );
    }
    return payments.map((p: any) => ({
      Id: p.Id,
      Invoice_Number__c: p.Invoice_Number__c,
      OrderId__c: p.OrderId__c,
      Amount__c: Number(p.Amount__c) || 0,
      Due_Date__c: p.Due_Date__c,
      Payment_Date__c: p.Payment_Date__c,
      Payment_Status__c: p.Payment_Status__c || 'Pending',
      CustomerName: null,
      Tracking_Status__c: null,
    }));
  }

  try {
    const conn = await getSFConnection();

    // Build SOQL WHERE conditions
    const conditions: string[] = [`Account__c = '${data.accountId}'`];
    const orParts: string[] = [];

    if (data.customerName) {
      const escaped = data.customerName.replace(/'/g, "\\'");
      // Match on Customer_First_Name__c or Customer_Last_Name__c
      orParts.push(`Customer_First_Name__c LIKE '%${escaped}%'`);
      orParts.push(`Customer_Last_Name__c LIKE '%${escaped}%'`);
    }
    if (data.orderId) {
      const escaped = data.orderId.replace(/'/g, "\\'");
      orParts.push(`Order__r.Name LIKE '%${escaped}%'`);
    }

    if (orParts.length > 0) {
      conditions.push(`(${orParts.join(' OR ')})`);
    }

    const whereClause = conditions.join(' AND ');
    const soql = `SELECT Id, Name, Account__c, Order__c, Order__r.Name, Amount__c, Due_Date__c, Payment_Date__c, Payment_Status__c, Customer_First_Name__c, Customer_Last_Name__c, Tracking_Status__c FROM Dealer_Invoice__c WHERE ${whereClause} ORDER BY CreatedDate DESC LIMIT 50`;

    console.log(`[SF] 🔍 SOQL: ${soql}`);
    const result = await conn.query<any>(soql);
    console.log(`[SF] ✅ Found ${result.records.length} invoices`);

    return result.records.map((r: any) => {
      let cName = null;
      if (r.Customer_First_Name__c || r.Customer_Last_Name__c) {
        cName = `${r.Customer_First_Name__c || ''} ${r.Customer_Last_Name__c || ''}`.trim();
      }
      return {
        Id: r.Id,
        Invoice_Number__c: r.Name,
        OrderId__c: (r.Order__r && r.Order__r.Name) ? r.Order__r.Name : r.Order__c,
        Amount__c: Number(r.Amount__c) || 0,
        Due_Date__c: r.Due_Date__c,
        Payment_Date__c: r.Payment_Date__c,
        Payment_Status__c: r.Payment_Status__c || 'Pending',
        CustomerName: cName,
        Tracking_Status__c: r.Tracking_Status__c || null,
      };
    });
  } catch (err: any) {
    // If the custom field doesn't exist, retry with a simpler query
    console.warn(`[SF] ⚠️ searchSFInvoices full query failed: ${err.message}`);
    try {
      const conn = await getSFConnection();
      const conditions: string[] = [`Account__c = '${data.accountId}'`];
      if (data.orderId) {
        conditions.push(`Order__r.Name LIKE '%${data.orderId.replace(/'/g, "\\'")}%'`);
      }
      const result = await conn.query<any>(
        `SELECT Id, Name, Account__c, Order__c, Order__r.Name, Amount__c, Due_Date__c, Payment_Date__c, Payment_Status__c FROM Dealer_Invoice__c WHERE ${conditions.join(' AND ')} ORDER BY CreatedDate DESC LIMIT 50`
      );
      return result.records.map((r: any) => ({
        Id: r.Id,
        Invoice_Number__c: r.Name,
        OrderId__c: (r.Order__r && r.Order__r.Name) ? r.Order__r.Name : r.Order__c,
        Amount__c: Number(r.Amount__c) || 0,
        Due_Date__c: r.Due_Date__c,
        Payment_Date__c: r.Payment_Date__c,
        Payment_Status__c: r.Payment_Status__c || 'Pending',
        CustomerName: null,
        Tracking_Status__c: null,
      }));
    } catch (e2: any) {
      console.error(`[SF] ❌ searchSFInvoices fallback failed: ${e2.message}`);
      throw e2;
    }
  }
}

// ─── syncLeadsFromSF ──────────────────────────────────────────────────────────
// Syncs Leads from Salesforce associated with the Dealer's Account ID (Dealer__c).
export async function syncLeadsFromSF(sfAccountId: string, mongoUserId: any): Promise<any[]> {
  console.log(`\n[SF] 🔄 syncLeadsFromSF() triggered for Account: ${sfAccountId}`);
  if (!sfAccountId || sfAccountId.startsWith('ACC')) {
    console.log(`[SF] ℹ️ Skipping real-time sync for mock Account ID: ${sfAccountId}`);
    const { LeadModel } = require('../models/Lead');
    return await LeadModel.find({ user: mongoUserId }).sort({ createdAt: -1 });
  }

  try {
    const conn = await getSFConnection();
    console.log(`[SF] 🔍 Fetching Leads from Salesforce for Account ID: ${sfAccountId}...`);
    const result = await conn.query<any>(
      `SELECT Id, FirstName, LastName, Company, Phone, Email, Status, LeadSource, Description, CreatedDate, ConvertedOpportunityId 
       FROM Lead 
       WHERE Dealer__c = '${sfAccountId}' 
       ORDER BY CreatedDate DESC`
    );

    console.log(`[SF] ✅ Retrieved ${result.records.length} Leads from Salesforce`);
    const { LeadModel } = require('../models/Lead');
    const syncedLeads: any[] = [];

    for (const record of result.records) {
      const leadData = {
        user: mongoUserId,
        sfId: record.Id,
        contactName: [record.FirstName, record.LastName].filter(Boolean).join(' ') || 'Unknown',
        phone: record.Phone || 'N/A',
        email: record.Email || 'N/A',
        companyName: record.Company || 'N/A',
        source: record.LeadSource || 'Other',
        status: record.Status || 'New',
        notes: record.Description || '',
        convertedToOpportunity: !!record.ConvertedOpportunityId,
        createdAt: record.CreatedDate ? record.CreatedDate.split('T')[0] : new Date().toISOString().split('T')[0]
      };

      const doc = await LeadModel.findOneAndUpdate(
        { sfId: record.Id },
        leadData,
        { upsert: true, new: true }
      );
      syncedLeads.push(doc);
    }
    return syncedLeads;
  } catch (err: any) {
    console.error(`[SF] ❌ syncLeadsFromSF() failed, falling back to local: ${err.message}`);
    const { LeadModel } = require('../models/Lead');
    return await LeadModel.find({ user: mongoUserId }).sort({ createdAt: -1 });
  }
}

// ─── syncOpportunitiesFromSF ──────────────────────────────────────────────────
// Syncs Opportunities from Salesforce where Dealer_Account__c (or Dealer__c) = dealerAccountId.
// Read-only — portal cannot modify these; all management done by SF team.
export async function syncOpportunitiesFromSF(sfAccountId: string, mongoUserId: any): Promise<any[]> {
  console.log(`\n[SF] 🔄 syncOpportunitiesFromSF() triggered for Account: ${sfAccountId}`);
  if (!sfAccountId || sfAccountId.startsWith('ACC')) {
    console.log(`[SF] ℹ️ Using mock opportunities for Account ID: ${sfAccountId}`);
    const { hydrateMockDataForAccount } = require('../db/mockHydrate');
    await hydrateMockDataForAccount(sfAccountId, mongoUserId);
    const { OpportunityModel } = require('../models/Opportunity');
    return await OpportunityModel.find({ user: mongoUserId }).sort({ createdAt: -1 });
  }

  const { OpportunityModel } = require('../models/Opportunity');

  // Try Dealer_Account__c first (preferred field name), then fall back to Dealer__c
  const queries = [
    `SELECT Id, Name, StageName, CloseDate, Amount, Probability, Description, CreatedDate, Account.Name FROM Opportunity WHERE Dealer_Account__c = '${sfAccountId}' ORDER BY CreatedDate DESC`,
    `SELECT Id, Name, StageName, CloseDate, Amount, Probability, Description, CreatedDate FROM Opportunity WHERE Dealer__c = '${sfAccountId}' ORDER BY CreatedDate DESC`,
  ];

  for (const soql of queries) {
    try {
      const conn = await getSFConnection();
      console.log(`[SF] 🔍 SOQL: ${soql.substring(0, 100)}...`);
      const result = await conn.query<any>(soql);
      console.log(`[SF] ✅ Retrieved ${result.records.length} Opportunities from Salesforce`);

      const syncedOpps: any[] = [];
      for (const record of result.records) {
        const oppData = {
          user: mongoUserId,
          sfId: record.Id,
          title: record.Name,
          name: record.Name,
          contactName: record.Account?.Name || 'N/A',
          companyName: record.Account?.Name || 'N/A',
          contactPhone: 'N/A',
          contactEmail: 'N/A',
          productName: 'See Salesforce',
          quantity: 1,
          unitPrice: Number(record.Amount) || 0,
          stage: record.StageName || 'Prospecting',
          expectedValue: Number(record.Amount) || 0,
          probability: Number(record.Probability) || 0,
          expectedCloseDate: record.CloseDate || '',
          notes: record.Description || '',
          createdAt: record.CreatedDate ? record.CreatedDate.split('T')[0] : new Date().toISOString().split('T')[0],
        };

        const doc = await OpportunityModel.findOneAndUpdate(
          { sfId: record.Id },
          oppData,
          { upsert: true, new: true }
        );
        syncedOpps.push(doc);
      }
      return syncedOpps;
    } catch (err: any) {
      console.warn(`[SF] ⚠️ Query failed: ${err.message}`);
      // Try next query
    }
  }

  // All queries failed — fall back to local MongoDB
  console.error(`[SF] ❌ syncOpportunitiesFromSF() all queries failed, falling back to local`);
  return await OpportunityModel.find({ user: mongoUserId }).sort({ createdAt: -1 });
}

// ─── createSFLead ─────────────────────────────────────────────────────────────
// Submits a standard Lead to Salesforce live, linked to the Dealer's Account ID (Dealer__c).
export async function createSFLead(data: {
  sfAccountId: string;
  contactName: string;
  phone: string;
  email: string;
  companyName: string;
  source: string;
  notes: string;
}): Promise<string> {
  console.log('[SF] 🚀 Submitting Lead to Salesforce live...');
  
  if (data.sfAccountId.startsWith('ACC')) {
    console.log('[SF] ℹ️ Using mock Account ID, skipping live Salesforce submission');
    return 'MOCK_LEAD_' + Date.now();
  }

  const conn = await getSFConnection();
  const names = data.contactName.trim().split(/\s+/);
  const firstName = names.length > 1 ? names[0] : '';
  const lastName = names.length > 1 ? names.slice(1).join(' ') : names[0] || 'Unknown';

  const payload = {
    FirstName: firstName,
    LastName: lastName,
    Company: data.companyName,
    Phone: data.phone,
    Email: data.email,
    LeadSource: data.source,
    Status: 'Open - Not Contacted',
    Description: data.notes,
    Dealer__c: data.sfAccountId // Relates Lead directly to Dealer Account
  };

  const result = await conn.sobject('Lead').create(payload);
  if (!result.success) {
    throw new Error(JSON.stringify(result.errors || []));
  }
  return result.id;
}
