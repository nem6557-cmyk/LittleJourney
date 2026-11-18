/**
 * Guards the things that get an app rejected from the stores. These are static
 * checks over the repo's assets/config so a regression fails CI, not review.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import appConfigFactory from '../../app.config';

const root = resolve(__dirname, '..', '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

/** Parse width/height/colour-type straight from a PNG IHDR chunk. */
function pngInfo(path: string) {
  const buf = readFileSync(resolve(root, path));
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] };
}
// PNG colour types: 2 = RGB, 6 = RGBA (alpha), 3 = palette, 0/4 = grey (+alpha)
const HAS_ALPHA = new Set([4, 6]);

const config = appConfigFactory({ config: {} } as never) as unknown as Record<string, any>;

describe('app icons (placeholder grid icons are an automatic rejection)', () => {
  it('store icon is 1024x1024 with NO alpha channel (App Store rejects transparency)', () => {
    const info = pngInfo('assets/icon.png');
    expect(info.width).toBe(1024);
    expect(info.height).toBe(1024);
    expect(HAS_ALPHA.has(info.colorType)).toBe(false);
  });

  it('is not the untouched Expo template (those files are ~22KB / ~17KB palette images)', () => {
    expect(pngInfo('assets/icon.png').colorType).not.toBe(3);
    expect(pngInfo('assets/adaptive-icon.png').colorType).not.toBe(3);
    expect(pngInfo('assets/splash-icon.png').colorType).not.toBe(3);
  });

  it('adaptive icon foreground is transparent and square', () => {
    const info = pngInfo('assets/adaptive-icon.png');
    expect(info.width).toBe(info.height);
    expect(HAS_ALPHA.has(info.colorType)).toBe(true);
  });

  it('every icon referenced from app.config.ts exists', () => {
    const refs = [
      config.icon,
      config.splash?.image,
      config.android?.adaptiveIcon?.foregroundImage,
      config.web?.favicon,
    ];
    const notifPlugin = (config.plugins as unknown[]).find(
      (p) => Array.isArray(p) && p[0] === 'expo-notifications',
    ) as [string, { icon: string }];
    refs.push(notifPlugin[1].icon);
    for (const ref of refs) {
      expect(typeof ref).toBe('string');
      expect(existsSync(resolve(root, ref as string))).toBe(true);
    }
  });
});

describe('PWA / Microsoft Store manifest', () => {
  const manifest = JSON.parse(read('public/manifest.json'));

  it('declares real icons that exist with the sizes they claim', () => {
    for (const icon of manifest.icons) {
      const file = icon.src.replace(/^\//, 'public/');
      expect(existsSync(resolve(root, file))).toBe(true);
      const [w, h] = icon.sizes.split('x').map(Number);
      const info = pngInfo(file);
      expect([info.width, info.height]).toEqual([w, h]);
    }
  });

  it('has a distinct maskable icon', () => {
    const maskable = manifest.icons.find((i: { purpose: string }) => i.purpose === 'maskable');
    expect(maskable).toBeDefined();
    const any512 = manifest.icons.find((i: { sizes: string; purpose: string }) => i.sizes === '512x512' && i.purpose === 'any');
    expect(maskable.src).not.toBe(any512.src);
    expect(statSync(resolve(root, 'public/icon-maskable-512.png')).size).not.toBe(
      statSync(resolve(root, 'public/icon-512.png')).size,
    );
  });

  it('does not disable pinch-zoom (WCAG 1.4.4)', () => {
    const html = read('public/index.html');
    expect(html).toMatch(/name="viewport"/);
    expect(html).not.toMatch(/maximum-scale/);
    expect(html).not.toMatch(/user-scalable\s*=\s*no/);
  });
});

describe('Android / iOS config', () => {
  it('blocks the microphone and broad media-read permissions we do not use', () => {
    const blocked: string[] = config.android.blockedPermissions;
    expect(blocked).toEqual(
      expect.arrayContaining([
        'android.permission.RECORD_AUDIO',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_EXTERNAL_STORAGE',
      ]),
    );
  });

  it('does not request permissions it blocks', () => {
    const requested: string[] = config.android.permissions.map((p: string) => `android.permission.${p}`);
    for (const b of config.android.blockedPermissions) expect(requested).not.toContain(b);
  });

  it('disables Android auto-backup (cached child/message data must not go to Drive)', () => {
    expect(config.android.allowBackup).toBe(false);
  });

  it('declares a light-only UI (no dark mode is implemented)', () => {
    expect(config.userInterfaceStyle).toBe('light');
  });

  it('declares non-exempt-encryption answer and payment-info privacy data', () => {
    expect(config.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
    const types = config.ios.privacyManifests.NSPrivacyCollectedDataTypes.map(
      (t: { NSPrivacyCollectedDataType: string }) => t.NSPrivacyCollectedDataType,
    );
    expect(types).toEqual(
      expect.arrayContaining([
        'NSPrivacyCollectedDataTypePaymentInfo',
        'NSPrivacyCollectedDataTypeDeviceID',
      ]),
    );
    expect(config.ios.privacyManifests.NSPrivacyTracking).toBe(false);
  });

  it('does not ship the unused expo-av / expo-network modules', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.dependencies['expo-av']).toBeUndefined();
    expect(pkg.dependencies['expo-network']).toBeUndefined();
  });

  it('points the Play submit key somewhere that is gitignored and is not the FCM file', () => {
    const eas = JSON.parse(read('eas.json'));
    const key = eas.submit.production.android.serviceAccountKeyPath as string;
    expect(key).not.toMatch(/google-services/);
    expect(read('.gitignore')).toContain(key.replace('./', ''));
  });
});

describe('billing-policy & trust copy', () => {
  const legalAndListing = ['public/terms.html', 'src/screens/legal/TermsOfServiceScreen.tsx', 'docs/STORE_LISTING.md'];

  it.each(legalAndListing)('%s does not advertise a parent premium subscription', (file) => {
    expect(read(file)).not.toMatch(/optionally subscribe to premium|premium upgrade/i);
  });

  it('terms disclose the platform fee on tuition payments', () => {
    expect(read('public/terms.html')).toMatch(/5% platform fee/);
    expect(read('src/screens/legal/TermsOfServiceScreen.tsx')).toMatch(/5% platform fee/);
  });

  it('has a hosted account-deletion page with the in-app path and a contact', () => {
    const page = read('public/delete-account.html');
    expect(page).toMatch(/Delete My Account/);
    expect(page).toMatch(/privacy@littlejourney\.app/);
  });

  it('no user-facing "coming soon / future update" placeholders remain in screens', () => {
    const files = [
      'src/screens/admin/AdminDashboard.tsx',
      'src/screens/shared/ProfileScreen.tsx',
    ];
    for (const f of files) {
      expect(read(f)).not.toMatch(/Coming Soon|future update/i);
    }
  });
});
