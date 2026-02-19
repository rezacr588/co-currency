import { type AppTheme } from './index';

// Augment both modules to ensure DefaultTheme is typed everywhere
declare module 'styled-components' {
  export interface DefaultTheme extends AppTheme {}
}

declare module 'styled-components/native' {
  export interface DefaultTheme extends AppTheme {}
}
