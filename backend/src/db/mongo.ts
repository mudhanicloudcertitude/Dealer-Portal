import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || '';

let useMock = false;

// We need to patch mongoose.model synchronously when this module is parsed
const originalModel = mongoose.model.bind(mongoose);

(mongoose as any).model = function(name: string, schema?: any): any {
  // Call original mongoose.model to register the schema (keeps type compilation and schema checks happy)
  const RealModel = originalModel(name, schema);

  let collectionName = 'cases';
  if (name.toLowerCase() === 'user') {
    collectionName = 'users';
  } else if (name.toLowerCase() === 'product') {
    collectionName = 'cachedProducts';
  } else if (name.toLowerCase() === 'order') {
    collectionName = 'cachedOrders';
  } else if (name.toLowerCase() === 'lead') {
    collectionName = 'leads';
  } else if (name.toLowerCase() === 'opportunity') {
    collectionName = 'opportunities';
  } else {
    collectionName = name.toLowerCase() + 's';
  }

  // Helper to convert mongoose query to simple match function
  const matchQuery = (item: any, query: any): boolean => {
    if (!query) return true;
    for (const key in query) {
      const val = query[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        // Handle nested operators or lookup objects if needed
        continue;
      }
      // Convert to string for easy matching of _id / user fields
      if (key === '_id' || key === 'user' || key === 'sfId') {
        const itemVal = item[key] ? item[key].toString() : '';
        const queryVal = val ? val.toString() : '';
        if (itemVal !== queryVal) return false;
      } else {
        if (item[key] !== val) return false;
      }
    }
    return true;
  };

  // Keep references to the original mongoose static methods
  const originalFindOne = RealModel.findOne.bind(RealModel);
  const originalFind = RealModel.find.bind(RealModel);
  const originalCountDocuments = RealModel.countDocuments.bind(RealModel);
  const originalCreate = RealModel.create.bind(RealModel);
  const originalFindOneAndUpdate = RealModel.findOneAndUpdate.bind(RealModel);
  const originalSave = RealModel.prototype.save;

  // Override static findOne
  RealModel.findOne = async function(this: any, query: any, ...args: any[]) {
    if (!useMock) {
      try {
        return await originalFindOne(query, ...args);
      } catch (err) {
        console.warn(`[MONGO-REAL] Query failed, falling back to mock:`, err);
      }
    }

    const { cacheDB } = require('./init');
    console.log(`🔍 [MONGO-MOCK] ${name}.findOne:`, JSON.stringify(query));
    const items = cacheDB.get(collectionName).value() || [];
    
    let found: any = null;
    if (query && query.$or) {
      found = items.find((item: any) => query.$or.some((subQuery: any) => matchQuery(item, subQuery)));
    } else {
      found = items.find((item: any) => matchQuery(item, query));
    }

    if (!found) return null;
    return createMockDocument(found, RealModel, collectionName);
  };

  // Override static find
  RealModel.find = function(this: any, query: any, ...args: any[]) {
    if (!useMock) {
      return originalFind(query, ...args);
    }

    const { cacheDB } = require('./init');
    console.log(`🔍 [MONGO-MOCK] ${name}.find:`, JSON.stringify(query));
    const items = cacheDB.get(collectionName).value() || [];
    const filtered = items.filter((item: any) => matchQuery(item, query));
    const wrapped = filtered.map((item: any) => createMockDocument(item, RealModel, collectionName));

    const chain = {
      sort: (sortSpec: any) => chain,
      lean: () => chain,
      then: (onfulfilled?: any) => Promise.resolve(wrapped).then(onfulfilled),
      catch: (onrejected?: any) => Promise.resolve(wrapped).catch(onrejected)
    };

    return chain as any;
  };

  // Override static countDocuments
  RealModel.countDocuments = async function(this: any, query: any, ...args: any[]) {
    if (!useMock) {
      try {
        return await originalCountDocuments(query, ...args);
      } catch (err) {
        console.warn(`[MONGO-REAL] countDocuments failed, falling back to mock:`, err);
      }
    }

    const { cacheDB } = require('./init');
    console.log(`🔍 [MONGO-MOCK] ${name}.countDocuments:`, JSON.stringify(query));
    const items = cacheDB.get(collectionName).value() || [];
    const filtered = query ? items.filter((item: any) => matchQuery(item, query)) : items;
    return filtered.length;
  };

  // Override static create
  RealModel.create = async function(this: any, doc: any, ...args: any[]) {
    if (!useMock) {
      try {
        return await originalCreate(doc, ...args);
      } catch (err) {
        console.warn(`[MONGO-REAL] create failed, falling back to mock:`, err);
      }
    }

    const { cacheDB } = require('./init');
    console.log(`💾 [MONGO-MOCK] ${name}.create:`, JSON.stringify(doc));
    
    const newDoc = {
      _id: doc._id || new mongoose.Types.ObjectId().toString(),
      ...doc,
    };

    cacheDB.get(collectionName).push(newDoc).write();
    return createMockDocument(newDoc, RealModel, collectionName);
  };

  // Override static findOneAndUpdate
  RealModel.findOneAndUpdate = async function(this: any, query: any, update: any, options: any = {}) {
    if (!useMock) {
      try {
        return await originalFindOneAndUpdate(query, update, options);
      } catch (err) {
        console.warn(`[MONGO-REAL] findOneAndUpdate failed, falling back to mock:`, err);
      }
    }

    const { cacheDB } = require('./init');
    console.log(`💾 [MONGO-MOCK] ${name}.findOneAndUpdate:`, JSON.stringify(query), JSON.stringify(update));
    const items = cacheDB.get(collectionName).value() || [];
    const foundIndex = items.findIndex((item: any) => matchQuery(item, query));
    
    let docToUpdate: any;
    if (foundIndex === -1) {
      if (options.upsert) {
        docToUpdate = {
          _id: new mongoose.Types.ObjectId().toString(),
          ...query,
        };
        if (update.$set) {
          Object.assign(docToUpdate, update.$set);
        } else {
          Object.assign(docToUpdate, update);
        }
        cacheDB.get(collectionName).push(docToUpdate).write();
        console.log(`💾 [MONGO-MOCK] ${name} upserted:`, JSON.stringify(docToUpdate));
      } else {
        return null;
      }
    } else {
      docToUpdate = { ...items[foundIndex] };
      if (update.$set) {
        Object.assign(docToUpdate, update.$set);
      } else {
        Object.assign(docToUpdate, update);
      }
      items[foundIndex] = docToUpdate;
      cacheDB.get(collectionName).assign(items).write();
      console.log(`💾 [MONGO-MOCK] ${name} updated:`, JSON.stringify(docToUpdate));
    }

    return createMockDocument(docToUpdate, RealModel, collectionName);
  };

  // Override prototype save
  RealModel.prototype.save = async function(this: any, ...args: any[]) {
    if (!useMock) {
      try {
        return await originalSave.apply(this, args);
      } catch (err) {
        console.warn(`[MONGO-REAL] save prototype failed, falling back to mock:`, err);
      }
    }

    const { cacheDB } = require('./init');
    console.log(`💾 [MONGO-MOCK] ${name}.prototype.save on document:`, this._id);
    const items = cacheDB.get(collectionName).value() || [];
    const docRaw = { ...this };
    
    // Strip any mongoose specific hidden properties/methods
    for (const key in docRaw) {
      if (typeof docRaw[key] === 'function' || key.startsWith('$')) {
        delete docRaw[key];
      }
    }

    const foundIndex = items.findIndex((item: any) => item._id?.toString() === docRaw._id?.toString());
    if (foundIndex === -1) {
      if (!docRaw._id) {
        docRaw._id = new mongoose.Types.ObjectId().toString();
      }
      cacheDB.get(collectionName).push(docRaw).write();
    } else {
      items[foundIndex] = docRaw;
      cacheDB.get(collectionName).assign(items).write();
    }
    return this;
  };

  return RealModel;
};

// Helper to construct a mock document that has prototype methods like save
function createMockDocument(data: any, ModelClass: any, collectionName: string) {
  if (!data) return null;
  const doc = new ModelClass(data);
  Object.assign(doc, data);
  if (data._id) {
    doc._id = data._id;
    doc.id = data.id || data._id.toString();
  }
  return doc;
}

export async function connectMongoDB(): Promise<void> {
  if (!MONGO_URI) {
    throw new Error('MONGO_URI is not defined in .env');
  }
  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    // Connect to real MongoDB with a timeout of 4 seconds so we fallback quickly
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 4000
    } as any);
    console.log('✅ MongoDB Atlas connected successfully');
  } catch (err: any) {
    console.error('❌ MongoDB connection failed:', err.message);
    console.log('⚠️ Falling back to local lowdb mock database!');
    
    useMock = true;

    // Ensure 'cases' collection exists in cacheDB
    const { cacheDB } = require('./init');
    if (!cacheDB.has('cases').value()) {
      cacheDB.set('cases', []).write();
    }
  }
}

