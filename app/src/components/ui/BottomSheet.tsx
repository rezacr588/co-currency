import { forwardRef, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { X } from 'lucide-react-native';
import { useColors } from '../../context/ThemeContext';

interface BottomSheetProps {
  title?: string;
  snapPoints?: (string | number)[];
  children: React.ReactNode;
  onClose?: () => void;
  enableDynamicSizing?: boolean;
}

export const BottomSheet = forwardRef<GorhomBottomSheet, BottomSheetProps>(
  (
    {
      title,
      snapPoints: customSnapPoints,
      children,
      onClose,
      enableDynamicSizing = true,
    },
    ref
  ) => {
    const colors = useColors();
    const snapPoints = useMemo(
      () => customSnapPoints || ['25%', '50%'],
      [customSnapPoints]
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      []
    );

    const handleClose = useCallback(() => {
      onClose?.();
    }, [onClose]);

    return (
      <GorhomBottomSheet
        ref={ref}
        index={-1}
        snapPoints={enableDynamicSizing ? undefined : snapPoints}
        enableDynamicSizing={enableDynamicSizing}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        onClose={handleClose}
        backgroundStyle={{
          backgroundColor: colors.card,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        }}
        handleIndicatorStyle={{
          backgroundColor: colors.mutedForeground,
          width: 40,
        }}
      >
        <BottomSheetView style={styles.content}>
          {title && (
            <View style={styles.header}>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 18,
                  fontFamily: 'Inter_600SemiBold',
                  flex: 1,
                }}
              >
                {title}
              </Text>
              {onClose && (
                <Pressable
                  onPress={handleClose}
                  hitSlop={8}
                  style={{
                    padding: 4,
                    borderRadius: 8,
                    backgroundColor: colors.secondary,
                  }}
                >
                  <X size={18} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>
          )}
          {children}
        </BottomSheetView>
      </GorhomBottomSheet>
    );
  }
);

BottomSheet.displayName = 'BottomSheet';

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
});
