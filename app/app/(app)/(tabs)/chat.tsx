import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyChatRoute() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();

  return (
    <Redirect
      href={{
        pathname: '/(app)/coai-chat',
        params,
      } as any}
    />
  );
}
