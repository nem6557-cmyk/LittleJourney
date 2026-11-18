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
  it('sends only the notification id when a session exists', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({ error: null });

    await dispatchPushNotification({ id: 'notif-1' });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('send-push', {
      body: { record: { id: 'notif-1' } },
    });
  });

  it('never forwards caller-supplied title/body/recipient (server reads them from the DB)', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({ error: null });

    await dispatchPushNotification({
      id: 'notif-2',
      user_id: 'victim',
      title: 'Your account is locked, tap here',
    } as unknown as { id: string });

    const call = (supabase.functions.invoke as jest.Mock).mock.calls[0];
    expect(call[1].body.record).toEqual({ id: 'notif-2' });
  });

  it('does not send when no session', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });

    await dispatchPushNotification({ id: 'notif-3' });

    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('handles invoke error gracefully', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({ error: { message: 'Function error' } });

    await expect(dispatchPushNotification({ id: 'notif-4' })).resolves.toBeUndefined();
  });

  it('handles network error gracefully', async () => {
    (supabase.auth.getSession as jest.Mock).mockRejectedValue(new Error('Network error'));

    await expect(dispatchPushNotification({ id: 'notif-5' })).resolves.toBeUndefined();
  });
});
