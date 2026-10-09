import { useState } from 'react';
import { Image, View } from 'react-native';
import { useSession } from '../../lib/supabase';
import { useTheme } from '../../lib/theme';
import { CHAT_AVATAR } from '../../lib/chatLayout';
import { userAvatarPresentation } from '../../lib/userAvatar';
import { Icon } from '../Icon';

/** The current account owns both the provider photo and its failure fallback. */
export function UserAvatar() {
  const session = useSession();
  const t = useTheme();
  const [failedIdentity, setFailedIdentity] = useState<string | null>(null);
  const { identity, uri } = userAvatarPresentation(session?.user.id, session?.user.user_metadata, failedIdentity);
  const style = { width: CHAT_AVATAR, height: CHAT_AVATAR, borderRadius: CHAT_AVATAR / 2, flexShrink: 0 as const };
  return uri ? (
    <Image key={identity} source={{ uri }} style={style} accessibilityLabel="Your profile photo" onError={() => setFailedIdentity(identity)} />
  ) : (
    <View accessibilityLabel="Your profile" style={[style, { alignItems: 'center', justifyContent: 'center', backgroundColor: t.color.surfaceInset }]}>
      <Icon name="person" size={22} color={t.color.textSecondary} />
    </View>
  );
}
