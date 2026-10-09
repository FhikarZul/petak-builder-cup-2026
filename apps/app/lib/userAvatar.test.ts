import {expect,it} from 'vitest';
import {userAvatarUrl,userAvatarPresentation} from './userAvatar';
it('reads Google/Supabase profile photo metadata and accepts missing Apple photos',()=>{
  expect(userAvatarUrl({avatar_url:'https://example.com/photo.jpg'})).toBe('https://example.com/photo.jpg');
  expect(userAvatarUrl({picture:'https://example.com/picture.jpg'})).toBe('https://example.com/picture.jpg');
  expect(userAvatarUrl({full_name:'Steven'})).toBeNull();
  expect(userAvatarUrl(undefined)).toBeNull();
});
it('rejects non-web and malformed values without preventing a valid alternative',()=>{
  expect(userAvatarUrl({avatar_url:'file:///private/photo',picture:'https://example.com/photo'})).toBe('https://example.com/photo');
  expect(userAvatarUrl({avatar_url:42,picture:'javascript:alert(1)'})).toBeNull();
});

it('falls back after a failed image but does not carry that failure across accounts or URLs', () => {
  const metadata={picture:'https://example.com/me.jpg'};
  const a=userAvatarPresentation('a',metadata,null);
  expect(a.uri).toBe(metadata.picture);
  expect(userAvatarPresentation('a',metadata,a.identity).uri).toBeNull();
  expect(userAvatarPresentation('b',metadata,a.identity).uri).toBe(metadata.picture);
  expect(userAvatarPresentation('a',{picture:'https://example.com/new.jpg'},a.identity).uri).toBe('https://example.com/new.jpg');
  expect(userAvatarPresentation(undefined,undefined,a.identity).uri).toBeNull();
});
