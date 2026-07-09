import { dispatchPushNotification } from '../lib/notifications';

// Mock supabase
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  setNotificationChannelAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  setBadgeCountAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
}));

jest.mock('expo-device', () => ({
  isDevice: true,
}));

const { supabase } = require('../lib/supabase');

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('dispatchPushNotification', () => {
  it('sends push notification when session exists', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({ error: null });

    await dispatchPushNotification({
      user_id: 'user-123',
      title: 'New Activity',
      body: 'Your child had lunch',
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('send-push', {
      body: {
        record: {
          user_id: 'user-123',
          title: 'New Activity',
          body: 'Your child had lunch',
        },
      },
    });
  });

  it('does not send when no session', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
    });

    await dispatchPushNotification({
      user_id: 'user-123',
      title: 'Test',
      body: 'Test body',
    });

    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('handles invoke error gracefully', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      error: { message: 'Function error' },
    });

    // Should not throw
    await expect(
      dispatchPushNotification({
        user_id: 'user-123',
        title: 'Test',
        body: 'Test',
      })
    ).resolves.toBeUndefined();
  });

  it('handles network error gracefully', async () => {
    (supabase.auth.getSession as jest.Mock).mockRejectedValue(new Error('Network error'));

    // Should not throw
    await expect(
      dispatchPushNotification({
        user_id: 'user-123',
        title: 'Test',
        body: 'Test',
      })
    ).resolves.toBeUndefined();
  });

  it('includes optional type and data fields', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({ error: null });

    await dispatchPushNotification({
      user_id: 'user-123',
      title: 'Meal Update',
      body: 'Emma had lunch',
      type: 'meal',
      data: { childId: 'child-456' },
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('send-push', {
      body: {
        record: {
          user_id: 'user-123',
          title: 'Meal Update',
          body: 'Emma had lunch',
          type: 'meal',
          data: { childId: 'child-456' },
        },
      },
    });
  });
});
