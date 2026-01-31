import { useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Trash2, Pencil, StickyNote } from 'lucide-react-native';
import { haptics } from '../../utils/haptics';

export interface SwipeAction {
  icon: 'delete' | 'edit' | 'note';
  color: string;
  backgroundColor: string;
  onPress: () => void;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  onSwipeOpen?: () => void;
  enabled?: boolean;
}

const ICON_MAP = {
  delete: Trash2,
  edit: Pencil,
  note: StickyNote,
};

function renderAction(
  action: SwipeAction,
  progress: Animated.AnimatedInterpolation<number>,
  dragX: Animated.AnimatedInterpolation<number>,
  index: number,
  isRight: boolean
) {
  const Icon = ICON_MAP[action.icon];
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [isRight ? 80 * (index + 1) : -80 * (index + 1), 0],
  });

  const scale = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.8, 0.9, 1],
  });

  return (
    <Animated.View
      key={`${action.icon}-${index}`}
      style={[
        styles.actionContainer,
        { backgroundColor: action.backgroundColor },
        { transform: [{ translateX }, { scale }] },
      ]}
    >
      <Pressable
        onPress={() => {
          haptics.medium();
          action.onPress();
        }}
        style={[styles.action]}
      >
        <Icon size={22} color={action.color} />
      </Pressable>
    </Animated.View>
  );
}

export function SwipeableRow({
  children,
  leftActions = [],
  rightActions = [],
  onSwipeOpen,
  enabled = true,
}: SwipeableRowProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    if (leftActions.length === 0) return null;

    return (
      <View style={styles.actionsContainer}>
        {leftActions.map((action, index) =>
          renderAction(action, progress, dragX, index, false)
        )}
      </View>
    );
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    if (rightActions.length === 0) return null;

    return (
      <View style={[styles.actionsContainer, styles.rightActionsContainer]}>
        {rightActions.map((action, index) =>
          renderAction(action, progress, dragX, index, true)
        )}
      </View>
    );
  };

  const handleSwipeOpen = (direction: 'left' | 'right') => {
    haptics.light();
    onSwipeOpen?.();
  };

  const close = () => {
    swipeableRef.current?.close();
  };

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      leftThreshold={40}
      rightThreshold={40}
      renderLeftActions={leftActions.length > 0 ? renderLeftActions : undefined}
      renderRightActions={rightActions.length > 0 ? renderRightActions : undefined}
      onSwipeableOpen={handleSwipeOpen}
      overshootLeft={false}
      overshootRight={false}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actionsContainer: {
    flexDirection: 'row',
  },
  rightActionsContainer: {
    justifyContent: 'flex-end',
  },
  actionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
  },
  action: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
