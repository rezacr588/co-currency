import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from 'styled-components/native';
import { getModeEntryRedirect, setCurrentMode } from '../../src/navigation/mode';

export default function FinAppEntryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const colors = theme.colors;

  useEffect(() => {
    let active = true;

    void (async () => {
      await setCurrentMode('finapp');
      const target = await getModeEntryRedirect('finapp');
      if (!active) return;
      router.replace(target as any);
    })();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}
