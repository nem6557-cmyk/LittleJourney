/**
 * Service layer integration tests.
 * Tests the service modules with mocked Supabase client.
 */

// Mock supabase before importing services
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockIn = jest.fn();
const mockOrder = jest.fn();
const mockSingle = jest.fn();
const mockLimit = jest.fn();

const mockChain = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  eq: mockEq,
  in: mockIn,
  order: mockOrder,
  single: mockSingle,
  limit: mockLimit,
};

// Each method returns the chain for fluent API
Object.values(mockChain).forEach((fn) => {
  (fn as jest.Mock).mockReturnValue(mockChain);
});

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => mockChain),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'token' } } }),
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/avatar.jpg' } }),
        createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed' }, error: null }),
        remove: jest.fn().mockResolvedValue({ error: null }),
        list: jest.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
}));

// Mock offline module
jest.mock('../lib/offline', () => ({
  withRetry: jest.fn((fn: () => Promise<any>) => fn()),
  isOnline: jest.fn().mockResolvedValue(true),
  cacheData: jest.fn(),
  getCachedData: jest.fn(),
  queueMutation: jest.fn(),
}));

const { supabase } = require('../lib/supabase');

import { childrenService } from '../services/children.service';
import { authorizedPickupsService } from '../services/authorized-pickups.service';
import { inviteCodesService } from '../services/invite-codes.service';

beforeEach(() => {
  jest.clearAllMocks();
  // Reset chain mock returns
  Object.values(mockChain).forEach((fn) => {
    (fn as jest.Mock).mockReturnValue(mockChain);
  });
});

// ============================================================
// Children Service
// ============================================================

describe('childrenService', () => {
  describe('getChildren', () => {
    it('fetches children with classroom join', async () => {
      mockOrder.mockResolvedValue({ data: [{ id: '1', first_name: 'Emma' }], error: null });

      const result = await childrenService.getChildren();

      expect(supabase.from).toHaveBeenCalledWith('children');
      expect(mockSelect).toHaveBeenCalledWith('*, classrooms(name, age_group)');
      expect(result).toEqual([{ id: '1', first_name: 'Emma' }]);
    });

    it('throws on error', async () => {
      mockOrder.mockResolvedValue({ data: null, error: { message: 'DB error' } });

      await expect(childrenService.getChildren()).rejects.toEqual({ message: 'DB error' });
    });
  });

  describe('getChild', () => {
    it('fetches a single child by ID', async () => {
      mockSingle.mockResolvedValue({ data: { id: 'child-1', first_name: 'Layla' }, error: null });

      const result = await childrenService.getChild('child-1');

      expect(supabase.from).toHaveBeenCalledWith('children');
      expect(mockEq).toHaveBeenCalledWith('id', 'child-1');
      expect(result).toEqual({ id: 'child-1', first_name: 'Layla' });
    });
  });

  describe('createChild', () => {
    it('inserts a new child record', async () => {
      mockSingle.mockResolvedValue({
        data: { id: 'new-1', first_name: 'Adam', last_name: 'Smith' },
        error: null,
      });

      const result = await childrenService.createChild({
        first_name: 'Adam',
        last_name: 'Smith',
        daycare_id: 'dc-1',
        date_of_birth: '2022-01-15',
        classroom_id: null,
        avatar_url: null,
        medical_notes: null,
      });

      expect(supabase.from).toHaveBeenCalledWith('children');
      expect(mockInsert).toHaveBeenCalledWith({
        first_name: 'Adam',
        last_name: 'Smith',
        daycare_id: 'dc-1',
        date_of_birth: '2022-01-15',
        classroom_id: null,
        avatar_url: null,
        medical_notes: null,
      });
      expect(result).toEqual({ id: 'new-1', first_name: 'Adam', last_name: 'Smith' });
    });

    it('throws on insert error', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'Duplicate' } });

      await expect(
        childrenService.createChild({
          first_name: 'Test',
          last_name: 'Child',
          daycare_id: 'dc-1',
          date_of_birth: '2022-01-01',
          classroom_id: null,
          avatar_url: null,
          medical_notes: null,
        })
      ).rejects.toEqual({ message: 'Duplicate' });
    });
  });

  describe('deleteChild', () => {
    it('deletes a child by ID', async () => {
      mockEq.mockResolvedValue({ error: null });

      await childrenService.deleteChild('child-1');

      expect(supabase.from).toHaveBeenCalledWith('children');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 'child-1');
    });
  });

  describe('linkParentChild', () => {
    it('creates a parent-child relationship', async () => {
      mockSingle.mockResolvedValue({
        data: { parent_id: 'p-1', child_id: 'c-1', relationship: 'parent' },
        error: null,
      });

      const result = await childrenService.linkParentChild('p-1', 'c-1');

      expect(supabase.from).toHaveBeenCalledWith('parent_children');
      expect(mockInsert).toHaveBeenCalledWith({
        parent_id: 'p-1',
        child_id: 'c-1',
        relationship: 'parent',
      });
      expect(result).toEqual({
        parent_id: 'p-1',
        child_id: 'c-1',
        relationship: 'parent',
      });
    });

    it('supports guardian relationship', async () => {
      mockSingle.mockResolvedValue({
        data: { parent_id: 'p-1', child_id: 'c-1', relationship: 'guardian' },
        error: null,
      });

      await childrenService.linkParentChild('p-1', 'c-1', 'guardian');

      expect(mockInsert).toHaveBeenCalledWith({
        parent_id: 'p-1',
        child_id: 'c-1',
        relationship: 'guardian',
      });
    });
  });
});

// ============================================================
// Invite Codes Service
// ============================================================

describe('inviteCodesService', () => {
  it('creates a daycare-scoped invite code', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'invite-1', code: 'A1B2C3D4', role: 'family' },
      error: null,
    });

    const result = await inviteCodesService.createInviteCode({
      daycareId: 'dc-1',
      createdBy: 'admin-1',
      role: 'family',
      childId: 'child-1',
    });

    expect(supabase.from).toHaveBeenCalledWith('invite_codes');
    expect(mockInsert).toHaveBeenCalledWith({
      daycare_id: 'dc-1',
      created_by: 'admin-1',
      role: 'family',
      child_id: 'child-1',
      classroom_id: null,
    });
    expect(result).toEqual({ id: 'invite-1', code: 'A1B2C3D4', role: 'family' });
  });

  it('supports admin staff invites', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'invite-2', code: 'Z9Y8X7W6', role: 'admin' },
      error: null,
    });

    await inviteCodesService.createInviteCode({
      daycareId: 'dc-1',
      createdBy: 'admin-1',
      role: 'admin',
    });

    expect(mockInsert).toHaveBeenCalledWith({
      daycare_id: 'dc-1',
      created_by: 'admin-1',
      role: 'admin',
      child_id: null,
      classroom_id: null,
    });
  });
});

// ============================================================
// Authorized Pickups Service
// ============================================================

describe('authorizedPickupsService', () => {
  it('lists pickups by child ids', async () => {
    mockOrder.mockResolvedValue({
      data: [{ id: 'pickup-1', child_id: 'child-1', name: 'Grandma' }],
      error: null,
    });

    const result = await authorizedPickupsService.listByChildIds(['child-1']);

    expect(supabase.from).toHaveBeenCalledWith('authorized_pickups');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockIn).toHaveBeenCalledWith('child_id', ['child-1']);
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(result).toEqual([{ id: 'pickup-1', child_id: 'child-1', name: 'Grandma' }]);
  });

  it('creates an unverified authorized pickup request', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'pickup-1', name: 'Grandma', verified: false },
      error: null,
    });

    const result = await authorizedPickupsService.createPickup({
      childId: 'child-1',
      daycareId: 'dc-1',
      name: 'Grandma',
      relationship: 'Grandparent',
      phone: '555-0100',
      createdBy: 'parent-1',
    });

    expect(supabase.from).toHaveBeenCalledWith('authorized_pickups');
    expect(mockInsert).toHaveBeenCalledWith({
      child_id: 'child-1',
      daycare_id: 'dc-1',
      name: 'Grandma',
      relationship: 'Grandparent',
      phone: '555-0100',
      created_by: 'parent-1',
    });
    expect(result).toEqual({ id: 'pickup-1', name: 'Grandma', verified: false });
  });
});

// ============================================================
// Stripe Checkout (via stripe.ts)
// ============================================================

describe('stripe createCheckoutSession', () => {
  it('exports createCheckoutSession function', async () => {
    const { createCheckoutSession } = require('../lib/stripe');
    expect(typeof createCheckoutSession).toBe('function');
  });

  it('exports getSubscriptionStatus function', async () => {
    const { getSubscriptionStatus } = require('../lib/stripe');
    expect(typeof getSubscriptionStatus).toBe('function');
  });
});
