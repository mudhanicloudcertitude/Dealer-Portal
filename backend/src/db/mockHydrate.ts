import crypto from 'crypto';
import { sfDB, cacheDB } from './init';

export function stableObjectId(seed: string): string {
  return crypto.createHash('md5').update(seed).digest('hex').slice(0, 24);
}

/** Ensure seeded users have stable _id values for mock-mode queries */
export function ensureStableUserIds(): void {
  const users = cacheDB.get('users').value() || [];
  let changed = false;
  for (const user of users) {
    if (!user._id) {
      user._id = stableObjectId(user.id || user.email);
      changed = true;
    }
  }
  if (changed) {
    cacheDB.get('users').assign(users).write();
    console.log('[MOCK] Assigned stable _id to seeded users');
  }
}

/** Copy sfDB seed data into cacheDB collections for mock account IDs (ACC*) */
export async function hydrateMockDataForAccount(accountId: string, mongoUserId: any): Promise<void> {
  if (!accountId?.startsWith('ACC')) return;

  ensureStableUserIds();
  const userId = mongoUserId?.toString?.() || mongoUserId;

  // Products
  const sfProducts = sfDB.get('products').value() || [];
  const sfPricebooks = sfDB.get('pricebooks').value() || [];
  const enrichedProducts = sfProducts.map((p: any) => {
    const pb = sfPricebooks.find((pb: any) => pb.Product2Id === p.Id);
    return {
      ...p,
      UnitPrice: pb?.UnitPrice,
      ListPrice: pb?.ListPrice,
      Forecasted_Demand__c: pb?.Forecasted_Demand__c,
      Restock_Recommendation__c: pb?.Restock_Recommendation__c,
    };
  });
  if ((cacheDB.get('cachedProducts').value() || []).length === 0 && enrichedProducts.length > 0) {
    cacheDB.set('cachedProducts', enrichedProducts).write();
  }

  const products = cacheDB.get('cachedProducts').value() || enrichedProducts;

  // Orders
  const sfOrders = sfDB.get('orders').filter({ AccountId: accountId }).value() || [];
  const sfOrderItems = sfDB.get('orderItems').value() || [];
  const existingOrders = cacheDB.get('cachedOrders').value() || [];

  for (const o of sfOrders) {
    if (existingOrders.some((e: any) => e.sfId === o.Id)) continue;
    const items = sfOrderItems.filter((oi: any) => oi.OrderId === o.Id);
    const firstItem = items[0];
    const product = products.find((p: any) => p.Id === firstItem?.Product2Id);
    const orderDoc = {
      _id: stableObjectId(o.Id),
      user: userId,
      accountId,
      sfId: o.Id,
      OrderNumber: o.OrderNumber,
      Product: product ? stableObjectId(product.Id) : stableObjectId(firstItem?.Product2Id || o.Id),
      ProductName: product?.Name || 'Product',
      ProductCode: product?.ProductCode || '',
      Quantity: firstItem?.Quantity || 1,
      UnitPrice: firstItem?.UnitPrice || 0,
      TotalAmount: o.TotalAmount,
      Status: o.Status,
      TrackingNumber: o.Tracking_Number__c || '',
      DeliveryDate: o.DeliveryDate__c || null,
      ShippingCity: o.ShippingCity || '',
      AppliedScheme: '',
      DiscountAmount: 0,
      CreatedDate: o.EffectiveDate,
      CustomerFirstName: '',
      CustomerLastName: '',
    };
    cacheDB.get('cachedOrders').push(orderDoc).write();
    existingOrders.push(orderDoc);
  }

  // Cases
  if (!cacheDB.has('cases').value()) {
    cacheDB.set('cases', []).write();
  }
  const sfCases = sfDB.get('cases').filter({ AccountId: accountId }).value() || [];
  const existingCases = cacheDB.get('cases').value() || [];
  for (const c of sfCases) {
    if (existingCases.some((e: any) => e.sfId === c.Id)) continue;
    const caseDoc = {
      _id: stableObjectId(c.Id),
      user: userId,
      accountId,
      sfId: c.Id,
      CaseNumber: c.CaseNumber,
      Subject: c.Subject,
      Description: c.Description,
      Priority: c.Priority,
      Status: c.Status,
      CreatedDate: (c.CreatedDate || '').split('T')[0] || c.CreatedDate,
      LastModifiedDate: (c.LastModifiedDate || '').split('T')[0] || c.LastModifiedDate,
      Resolution__c: c.Resolution__c,
    };
    cacheDB.get('cases').push(caseDoc).write();
    existingCases.push(caseDoc);
  }

  // Opportunities
  const sfOpps = sfDB.get('opportunities').filter({ Dealer__c: accountId }).value() || [];
  const existingOpps = cacheDB.get('opportunities').value() || [];
  for (const o of sfOpps) {
    if (existingOpps.some((e: any) => e.sfId === o.Id)) continue;
    cacheDB.get('opportunities').push({
      _id: stableObjectId(o.Id),
      user: userId,
      sfId: o.Id,
      title: o.Name,
      name: o.Name,
      stage: o.StageName,
      expectedValue: o.Amount,
      expectedCloseDate: o.CloseDate,
      probability: o.Probability,
      notes: o.Description,
    }).write();
  }

  // Inventory
  const sfInv = sfDB.get('dealerInventory').filter({ Dealer__c: accountId }).value() || [];
  if ((cacheDB.get('cachedInventory').value() || []).length === 0 && sfInv.length > 0) {
    cacheDB.set('cachedInventory', sfInv.map((inv: any) => {
      const pb = sfPricebooks.find((p: any) => p.Product2Id === inv.Product2Id);
      const qty = inv.Quantity__c || inv.Stock_On_Hand__c || 0;
      return {
        _id: stableObjectId(inv.Id),
        user: userId,
        accountId,
        Dealer__c: inv.Dealer__c,
        Product2Id: inv.Product2Id,
        Product_Name__c: inv.Product_Name__c,
        Quantity__c: qty,
        Amount__c: inv.Amount__c || (qty * (pb?.UnitPrice || 0)),
      };
    })).write();
  }

  // Payments cache
  const sfPayments = sfDB.get('dealerPayments').filter({ Dealer__c: accountId }).value() || [];
  if ((cacheDB.get('cachedPayments').value() || []).length === 0 && sfPayments.length > 0) {
    cacheDB.set('cachedPayments', sfPayments).write();
  }

  console.log(`[MOCK] ✅ Hydrated mock data for account ${accountId}`);
}
