import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

interface MutationActionOptions<TData, TError, TVariables, TContext> 
  extends UseMutationOptions<TData, TError, TVariables, TContext> {
  successMessage?: string;
  errorMessage?: string;
  invalidateQueries?: string[][];
  onSuccessAction?: (data: TData) => void;
}

/**
 * A reusable hook for mutations that handles common logic like:
 * - Showing success/error toasts
 * - Invalidating related queries
 * - Translating generic error messages
 */
export function useMutationAction<TData = any, TError = any, TVariables = any, TContext = any>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: MutationActionOptions<TData, TError, TVariables, TContext> = {}
) {
  const queryClient = useQueryClient();
  const { success, error: showErrorToast } = useToast();
  const { t } = useLanguage();

  return useMutation({
    mutationFn,
    ...options,
    onSuccess: (data, variables, context) => {
      // Invalidate specified queries
      if (options.invalidateQueries) {
        options.invalidateQueries.forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey });
        });
      }

      // Show success toast
      if (options.successMessage) {
        success(options.successMessage);
      }

      // Call original onSuccess if provided
      if (options.onSuccess) {
        // @ts-expect-error - Handle variance in argument count across library versions
        options.onSuccess(data, variables, context, undefined);
      }

      // Call custom action
      if (options.onSuccessAction) {
        options.onSuccessAction(data);
      }
    },
    onError: (err, variables, context) => {
      // Extract error message
      const msg = err instanceof Error ? err.message : String(err);
      
      // Show error toast
      showErrorToast(options.errorMessage || msg || t('operationFailed' as any));

      // Call original onError if provided
      if (options.onError) {
        // @ts-expect-error - Handle variance in argument count across library versions
        options.onError(err, variables, undefined, context);
      }
    },
  });
}
