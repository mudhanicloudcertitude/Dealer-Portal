import { Router } from 'express';
import { cacheDB, sfDB } from '../db/init';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/products - Full catalog with pricing
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { ProductModel } = await import('../models/Product');
    const products = await ProductModel.find({});
    if (!products || products.length === 0) {
      const sfProducts = sfDB.get('products').value();
      const sfPricebooks = sfDB.get('pricebooks').value();
      const enriched = sfProducts.map((p: any) => {
        const pb = sfPricebooks.find((pb: any) => pb.Product2Id === p.Id);
        return { ...p, UnitPrice: pb?.UnitPrice, ListPrice: pb?.ListPrice, Forecasted_Demand__c: pb?.Forecasted_Demand__c };
      });
      return res.json(enriched);
    }
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  }
});

// GET /api/products/:id
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { ProductModel } = await import('../models/Product');
    const product = await ProductModel.findOne({ Id: req.params.id });
    if (product) return res.json(product);

    const sfProduct = sfDB.get('products').find({ Id: req.params.id }).value();
    if (!sfProduct) return res.status(404).json({ error: 'Product not found' });
    const pb = sfDB.get('pricebooks').find({ Product2Id: sfProduct.Id }).value();
    res.json({ ...sfProduct, UnitPrice: pb?.UnitPrice, ListPrice: pb?.ListPrice });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch product', details: err.message });
  }
});

export default router;
