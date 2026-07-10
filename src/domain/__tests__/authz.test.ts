import { describe, expect, it } from 'vitest';
import { assertCanAccess, assertCanReassign, canAccess, canReassign } from '../authz';
import type { User } from '../types';

const rep: User = { name: 'Phúc', role: 'rep' };
const otherRep: User = { name: 'Linh', role: 'rep' };
const manager: User = { name: 'Thảo', role: 'manager' };

describe('canAccess', () => {
  it('a rep can access their own record', () => {
    expect(canAccess(rep, { salesRep: 'Phúc' })).toBe(true);
  });

  it('a rep cannot access another rep\'s record', () => {
    expect(canAccess(rep, { salesRep: 'Linh' })).toBe(false);
  });

  it('a manager can access any record', () => {
    expect(canAccess(manager, { salesRep: 'Phúc' })).toBe(true);
    expect(canAccess(manager, { salesRep: 'Linh' })).toBe(true);
  });
});

describe('canReassign', () => {
  it('only a manager may reassign', () => {
    expect(canReassign(manager)).toBe(true);
    expect(canReassign(rep)).toBe(false);
    expect(canReassign(otherRep)).toBe(false);
  });
});

describe('assertCanAccess / assertCanReassign', () => {
  it('assertCanAccess throws FORBIDDEN for a non-owning rep', () => {
    expect(() => assertCanAccess(rep, { salesRep: 'Linh' })).toThrow('FORBIDDEN');
  });

  it('assertCanAccess does not throw for the owner or a manager', () => {
    expect(() => assertCanAccess(rep, { salesRep: 'Phúc' })).not.toThrow();
    expect(() => assertCanAccess(manager, { salesRep: 'Linh' })).not.toThrow();
  });

  it('assertCanReassign throws FORBIDDEN_REASSIGN for a rep', () => {
    expect(() => assertCanReassign(rep)).toThrow('FORBIDDEN_REASSIGN');
  });

  it('assertCanReassign does not throw for a manager', () => {
    expect(() => assertCanReassign(manager)).not.toThrow();
  });
});
