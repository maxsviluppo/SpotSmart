import firebaseConfig from '../../firebase-applet-config.json';

if (typeof window === 'undefined') {
  try {
    const dummyStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, length: 0, key: () => null };
    Object.defineProperty(globalThis, 'localStorage', { value: dummyStorage, writable: true, configurable: true });
  } catch (e) {}
}

let app: any = null;
let db: any = {};
let auth: any = null;
let googleProvider: any = null;

if (typeof window !== 'undefined') {
  try {
    const { initializeApp } = require('firebase/app');
    const { getFirestore } = require('firebase/firestore');
    const { getAuth, GoogleAuthProvider } = require('firebase/auth');
    
    app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
  } catch (e) {}
}

// Auth Helpers
export const loginWithGoogle = () => {
  if (typeof window !== 'undefined' && auth) {
    const { signInWithPopup } = require('firebase/auth');
    return signInWithPopup(auth, googleProvider);
  }
  return Promise.resolve();
};

export const logout = () => {
  if (typeof window !== 'undefined' && auth) {
    const { signOut } = require('firebase/auth');
    return signOut(auth);
  }
  return Promise.resolve();
};

const onAuthStateChanged = (authObj: any, callback: any) => {
  if (typeof window !== 'undefined') {
    const { onAuthStateChanged: oasc } = require('firebase/auth');
    return oasc(authObj, callback);
  }
  return () => {};
};

// Firestore Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  if (!errInfo.error.includes('permission')) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  throw new Error(JSON.stringify(errInfo));
}

// Connection test confinato al browser
if (typeof window !== 'undefined') {
  setTimeout(() => {
    try {
      const { doc, getDocFromServer } = require('firebase/firestore');
      getDocFromServer(doc(db, 'test', 'connection')).catch((error: any) => {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      });
    } catch (e) {}
  }, 2000);
}

// Proxy wrappers per destrutturazione lazy-loaded in esecuzione solo sul client
export const collection = (...args: any[]) => {
  if (typeof window !== 'undefined') {
    const { collection: fn } = require('firebase/firestore');
    return fn(...args);
  }
  return {};
};

export const doc = (...args: any[]) => {
  if (typeof window !== 'undefined') {
    const { doc: fn } = require('firebase/firestore');
    return fn(...args);
  }
  return {};
};

export const setDoc = (...args: any[]) => {
  if (typeof window !== 'undefined') {
    const { setDoc: fn } = require('firebase/firestore');
    return fn(...args);
  }
  return Promise.resolve();
};

export const deleteDoc = (...args: any[]) => {
  if (typeof window !== 'undefined') {
    const { deleteDoc: fn } = require('firebase/firestore');
    return fn(...args);
  }
  return Promise.resolve();
};

export const onSnapshot = (...args: any[]) => {
  if (typeof window !== 'undefined') {
    const { onSnapshot: fn } = require('firebase/firestore');
    return fn(...args);
  }
  return () => {};
};

export const query = (...args: any[]) => {
  if (typeof window !== 'undefined') {
    const { query: fn } = require('firebase/firestore');
    return fn(...args);
  }
  return {};
};

export const where = (...args: any[]) => {
  if (typeof window !== 'undefined') {
    const { where: fn } = require('firebase/firestore');
    return fn(...args);
  }
  return {};
};

export const getDoc = (...args: any[]) => {
  if (typeof window !== 'undefined') {
    const { getDoc: fn } = require('firebase/firestore');
    return fn(...args);
  }
  return Promise.resolve({ exists: () => false, data: () => ({}), id: '' });
};

export const addDoc = (...args: any[]) => {
  if (typeof window !== 'undefined') {
    const { addDoc: fn } = require('firebase/firestore');
    return fn(...args);
  }
  return Promise.resolve({ id: 'dummy' });
};

export const updateDoc = (...args: any[]) => {
  if (typeof window !== 'undefined') {
    const { updateDoc: fn } = require('firebase/firestore');
    return fn(...args);
  }
  return Promise.resolve();
};

export const Timestamp = {
  now: () => {
    if (typeof window !== 'undefined') {
      const { Timestamp: ts } = require('firebase/firestore');
      return ts.now();
    }
    return { toDate: () => new Date(), seconds: Math.floor(Date.now()/1000) };
  },
  fromDate: (date: Date) => {
    if (typeof window !== 'undefined') {
      const { Timestamp: ts } = require('firebase/firestore');
      return ts.fromDate(date);
    }
    return { toDate: () => date, seconds: Math.floor(date.getTime()/1000) };
  }
};

export { db, auth, googleProvider, onAuthStateChanged };
export type User = any;
