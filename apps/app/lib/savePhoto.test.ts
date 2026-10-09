import { describe, expect, it } from 'vitest';
import {
  SAVE_PHOTO_LINES,
  deniedLine,
  failedLine,
  savedLine,
  unavailableLine,
} from './savePhoto';

// Run A #8. The founder ruled 4 Sep that the download ships: a camera photo
// lives only in Petak, so this is the only way one gets out. These pin the
// WORDS, because every branch here is something going wrong and the user's
// only recourse is what the line tells them.
describe('save-photo outcomes', () => {
  it('says plainly when it worked', () => {
    expect(savedLine()).toEqual({ ok: true, message: 'Saved to your photos.' });
  });

  // A denial is recoverable and the line must say where. "Permission denied"
  // alone leaves the user stuck inside an app that cannot fix it.
  it('tells a refused user where to change it', () => {
    const r = deniedLine();
    expect(r.ok).toBe(false);
    expect(r.message).toContain('Settings');
  });

  // The same honest degradation pickDocument uses: an APK installed before
  // this shipped has no native module, and that is a build problem, not a
  // failure the user caused.
  it('blames the build, not the user, on an old APK', () => {
    expect(unavailableLine()).toEqual({ ok: false, message: 'Saving needs the latest app build.' });
  });

  it('offers a retry when it simply did not work', () => {
    expect(failedLine().message).toContain('Try again');
  });

  // Four outcomes, four distinct lines — a repeated string would leave two
  // different problems looking identical.
  it('gives every outcome its own words', () => {
    const lines = Object.values(SAVE_PHOTO_LINES);
    expect(new Set(lines).size).toBe(lines.length);
  });
});
