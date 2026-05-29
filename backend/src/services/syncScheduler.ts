import { sfDB, cacheDB } from '../db/init';

let syncCount = 0;
let lastSyncTime: string | null = null;

export function runSync(): { success: boolean; changes: number; timestamp: string; log: string[] } {
  syncCount++;
  const timestamp = new Date().toISOString();
  const log: string[] = [];
  let changes = 0;

  try {
    log.push(`[SYNC #${syncCount}] Starting sync at ${timestamp}`);

    // Sync Products
    const sfProducts = sfDB.get('products').value();
    const sfPricebooks = sfDB.get('pricebooks').value();
    const enrichedProducts = sfProducts.map((p: any) => {
      const pb = sfPricebooks.find((pb: any) => pb.Product2Id === p.Id);
      return { ...p, UnitPrice: pb?.UnitPrice, ListPrice: pb?.ListPrice, Forecasted_Demand__c: pb?.Forecasted_Demand__c, Restock_Recommendation__c: pb?.Restock_Recommendation__c };
    });
    cacheDB.set('cachedProducts', enrichedProducts).write();
    changes += enrichedProducts.length;
    log.push(`  ✓ Synced ${enrichedProducts.length} products`);

    // Sync Orders
    const sfOrders = sfDB.get('orders').value();
    const sfOrderItems = sfDB.get('orderItems').value();
    const enrichedOrders = sfOrders.map((o: any) => ({
      ...o,
      items: sfOrderItems.filter((oi: any) => oi.OrderId === o.Id),
    }));
    cacheDB.set('cachedOrders', enrichedOrders).write();
    changes += enrichedOrders.length;
    log.push(`  ✓ Synced ${enrichedOrders.length} orders`);

    // Sync Inventory
    const sfInventory = sfDB.get('dealerInventory').value();
    cacheDB.set('cachedInventory', sfInventory).write();
    changes += sfInventory.length;
    log.push(`  ✓ Synced ${sfInventory.length} inventory records`);

    // Sync Payments
    const sfPayments = sfDB.get('dealerPayments').value();
    cacheDB.set('cachedPayments', sfPayments).write();
    changes += sfPayments.length;
    log.push(`  ✓ Synced ${sfPayments.length} payment records`);

    // Sync Warranty
    const sfWarranty = sfDB.get('warrantyRegs').value();
    cacheDB.set('cachedWarranty', sfWarranty).write();
    changes += sfWarranty.length;
    log.push(`  ✓ Synced ${sfWarranty.length} warranty records`);

    // Sync Leads
    const sfLeads = sfDB.get('leads').value() || [];
    cacheDB.set('leads', sfLeads).write();
    changes += sfLeads.length;
    log.push(`  ✓ Synced ${sfLeads.length} leads`);

    // Sync Opportunities
    const sfOpps = sfDB.get('opportunities').value() || [];
    cacheDB.set('opportunities', sfOpps).write();
    changes += sfOpps.length;
    log.push(`  ✓ Synced ${sfOpps.length} opportunities`);

    // Check low inventory and create notifications
    const lowStockItems = sfInventory.filter((item: any) => item.Stock_On_Hand__c < item.Min_Stock_Level__c);
    if (lowStockItems.length > 0) {
      const notification = {
        id: `NOTIF-${Date.now()}`,
        type: 'warning',
        title: 'Low Stock Alert',
        message: `${lowStockItems.length} product(s) below minimum stock level`,
        items: lowStockItems.map((i: any) => i.Product_Name__c),
        timestamp,
        read: false,
      };
      const existingNotifs = cacheDB.get('notifications').value();
      const recentLowStock = existingNotifs.filter(
        (n: any) => n.type === 'warning' && n.title === 'Low Stock Alert' && 
          new Date(n.timestamp).getTime() > Date.now() - 10 * 60 * 1000
      );
      if (recentLowStock.length === 0) {
        cacheDB.get('notifications').push(notification).write();
        log.push(`  ⚠ Low stock notification created for ${lowStockItems.length} items`);
      }
    }

    // Log sync entry
    const syncEntry = { id: `SYNC-${syncCount}`, timestamp, changes, status: 'success', log };
    sfDB.get('syncLog').push(syncEntry).write();
    
    lastSyncTime = timestamp;
    console.log(`🔄 [Sync #${syncCount}] ${changes} records synced at ${new Date().toLocaleTimeString()}`);
    
    return { success: true, changes, timestamp, log };
  } catch (err: any) {
    log.push(`  ✗ Sync error: ${err.message}`);
    const syncEntry = { id: `SYNC-${syncCount}`, timestamp, changes: 0, status: 'error', log };
    sfDB.get('syncLog').push(syncEntry).write();
    return { success: false, changes: 0, timestamp, log };
  }
}

export function getSyncStatus() {
  return {
    syncCount,
    lastSyncTime,
    syncLog: sfDB.get('syncLog').value().slice(-10),
  };
}
