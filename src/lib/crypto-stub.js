// Stub module for node:crypto when bundled for client-side
// prisma-field-encryption uses crypto for hashing, but client doesn't need it
export default {};
export const randomBytes = () => Buffer.alloc(0);
export const createHash = () => ({ update: () => ({ digest: () => Buffer.alloc(0) }) });
export const createHmac = () => ({ update: () => ({ digest: () => Buffer.alloc(0) }) });
export const randomUUID = () => 'stub-uuid';