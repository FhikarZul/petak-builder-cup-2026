import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { chatWidths } from '../../lib/chatLayout';

const WidthContext = createContext<ReturnType<typeof chatWidths> | null>(null);

/** Measure the feed itself so split views use their actual available space. */
export function ChatLayout({ children }: { children: ReactNode }) {
  const window = useWindowDimensions();
  const [viewport, setViewport] = useState<number | null>(null);
  const widths = useMemo(() => chatWidths(viewport ?? window.width), [viewport, window.width]);
  return (
    <View style={{ flex: 1 }} onLayout={({ nativeEvent: { layout } }) => setViewport(layout.width)}>
      <WidthContext.Provider value={widths}>{children}</WidthContext.Provider>
    </View>
  );
}

export function useChatWidths() {
  const width = useContext(WidthContext);
  const window = useWindowDimensions();
  return width ?? chatWidths(window.width);
}
