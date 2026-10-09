// Down to one paid neighbour — who stays, and what happens if you say
// nothing (Run B #10).
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlaceholderScreen } from '../../../components/PlaceholderScreen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { useTheme } from '../../../lib/theme';

export default function WhoStays() {
  const t = useTheme();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: t.color.surfacePage }}>
      <ScreenHeader title="Who stays" />
      <PlaceholderScreen name="Who stays" moments="Run B #10" />
    </SafeAreaView>
  );
}
