import { forwardRef, type ComponentProps } from 'react';
import { type View } from 'react-native';
import {
  Card as BaseCard,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '../Card';

export type StyledCardProps = ComponentProps<typeof BaseCard>;

export const StyledCard = forwardRef<View, StyledCardProps>((props, ref) => {
  return <BaseCard ref={ref} {...props} />;
});

StyledCard.displayName = 'StyledCard';

export { CardHeader, CardTitle, CardContent, CardFooter };
