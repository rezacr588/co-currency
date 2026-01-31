import * as StoreReview from 'expo-store-review';
import { Platform } from 'react-native';
import { readJSON, writeJSON } from './storage';

const REVIEW_DATA_KEY = 'app_review_data';

interface ReviewData {
  hasRequestedReview: boolean;
  lastRequestDate: string | null;
  positiveActionsCount: number;
  appOpenCount: number;
}

const DEFAULT_REVIEW_DATA: ReviewData = {
  hasRequestedReview: false,
  lastRequestDate: null,
  positiveActionsCount: 0,
  appOpenCount: 0,
};

// Minimum requirements before showing review prompt
const MIN_POSITIVE_ACTIONS = 5;
const MIN_APP_OPENS = 3;
const MIN_DAYS_BETWEEN_PROMPTS = 30;

async function getReviewData(): Promise<ReviewData> {
  const data = await readJSON<ReviewData>(REVIEW_DATA_KEY);
  return data || DEFAULT_REVIEW_DATA;
}

async function saveReviewData(data: ReviewData): Promise<void> {
  await writeJSON(REVIEW_DATA_KEY, data);
}

/**
 * Track app open - call this when app becomes active
 */
export async function trackAppOpen(): Promise<void> {
  const data = await getReviewData();
  data.appOpenCount += 1;
  await saveReviewData(data);
}

/**
 * Track a positive action (goal completed, badge earned, etc.)
 * This increases the likelihood of showing a review prompt
 */
export async function trackPositiveAction(): Promise<void> {
  const data = await getReviewData();
  data.positiveActionsCount += 1;
  await saveReviewData(data);
}

/**
 * Check if we should request a review and show the prompt if appropriate
 * Call this after positive user actions like:
 * - Completing a goal
 * - Earning a badge
 * - Completing a challenge
 * - First week of consistent usage
 */
export async function maybeRequestReview(): Promise<boolean> {
  // Only works on native platforms
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    // Check if StoreReview is available
    const isAvailable = await StoreReview.isAvailableAsync();
    if (!isAvailable) {
      return false;
    }

    const data = await getReviewData();

    // Check minimum requirements
    if (data.positiveActionsCount < MIN_POSITIVE_ACTIONS) {
      return false;
    }

    if (data.appOpenCount < MIN_APP_OPENS) {
      return false;
    }

    // Check if we've requested recently
    if (data.lastRequestDate) {
      const lastRequest = new Date(data.lastRequestDate);
      const daysSinceLastRequest = Math.floor(
        (Date.now() - lastRequest.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastRequest < MIN_DAYS_BETWEEN_PROMPTS) {
        return false;
      }
    }

    // All conditions met - request review
    await StoreReview.requestReview();

    // Update tracking data
    data.hasRequestedReview = true;
    data.lastRequestDate = new Date().toISOString();
    await saveReviewData(data);

    return true;
  } catch (error) {
    console.error('Error requesting review:', error);
    return false;
  }
}

/**
 * Force request review (for testing or special occasions)
 * Use sparingly - only when user explicitly wants to rate
 */
export async function forceRequestReview(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    const isAvailable = await StoreReview.isAvailableAsync();
    if (!isAvailable) {
      return false;
    }

    await StoreReview.requestReview();
    return true;
  } catch (error) {
    console.error('Error forcing review:', error);
    return false;
  }
}

/**
 * Check if the app can request a review
 */
export async function canRequestReview(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    return await StoreReview.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Get the store URL for manual review (fallback)
 * TODO: Update iOS App Store ID when available
 */
export function getStoreUrl(): string | null {
  if (Platform.OS === 'ios') {
    // iOS App Store ID not yet configured - return null until app is published
    // Once published, replace with actual ID: 'https://apps.apple.com/app/id{APP_ID}'
    return null;
  } else if (Platform.OS === 'android') {
    return 'https://play.google.com/store/apps/details?id=com.cofinance.app';
  }
  return null;
}
