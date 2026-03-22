/**
 * Hit Slop Constants for Touch Target Enhancement
 * 
 * These constants provide consistent touch target expansion for interactive elements.
 * Use these to ensure all tap targets meet minimum accessibility standards (44x44pt iOS, 48x48dp Android).
 * 
 * @example
 * ```tsx
 * // Small buttons/icons (8px expansion)
 * <Pressable hitSlop={HIT_SLOP_SM}>
 *   <Icon size={20} />
 * </Pressable>
 * 
 * // Medium interactive elements (12px expansion)
 * <Pressable hitSlop={HIT_SLOP_MD}>
 *   <Text>Action</Text>
 * </Pressable>
 * 
 * // Large touch areas (16px expansion)
 * <Pressable hitSlop={HIT_SLOP_LG}>
 *   <SmallButton />
 * </Pressable>
 * ```
 */

/**
 * Small hit slop - 8px expansion on all sides
 * Use for: Icon-only buttons, close buttons, small action buttons
 * Expands 32x32 element to 48x48 effective tap area
 */
export const HIT_SLOP_SM = {
  top: 8,
  bottom: 8,
  left: 8,
  right: 8,
} as const;

/**
 * Medium hit slop - 12px expansion on all sides
 * Use for: Text links, secondary actions, nav items
 * Expands 32x32 element to 56x56 effective tap area
 */
export const HIT_SLOP_MD = {
  top: 12,
  bottom: 12,
  left: 12,
  right: 12,
} as const;

/**
 * Large hit slop - 16px expansion on all sides
 * Use for: Very small elements, critical actions needing generous tap area
 * Expands 32x32 element to 64x64 effective tap area
 */
export const HIT_SLOP_LG = {
  top: 16,
  bottom: 16,
  left: 16,
  right: 16,
} as const;

/**
 * Asymmetric hit slop for edge elements (e.g., screen corners)
 * Use when element is close to screen edge and needs expansion in specific directions
 */
export const HIT_SLOP_EDGE_RIGHT = {
  top: 12,
  bottom: 12,
  left: 12,
  right: 24, // Extra expansion away from edge
} as const;

export const HIT_SLOP_EDGE_LEFT = {
  top: 12,
  bottom: 12,
  left: 24,
  right: 12,
} as const;
