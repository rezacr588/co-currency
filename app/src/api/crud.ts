import { fetchAPI } from './base';

/**
 * Factory for creating standard CRUD API modules.
 *
 * Returns list, get, create, update, and delete operations.
 * Spread custom methods onto the result for resource-specific endpoints.
 */
export function createCRUDApi<
  TListResponse,
  TGetResponse,
  TCreateData,
  TCreateResponse,
  TUpdateData,
  TUpdateResponse = TCreateResponse,
  TDeleteResponse = { message: string },
>(basePath: string) {
  return {
    list: () => fetchAPI<TListResponse>(basePath),
    get: (id: string) => fetchAPI<TGetResponse>(`${basePath}/${id}`),
    create: (data: TCreateData) =>
      fetchAPI<TCreateResponse>(basePath, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: TUpdateData) =>
      fetchAPI<TUpdateResponse>(`${basePath}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchAPI<TDeleteResponse>(`${basePath}/${id}`, {
        method: 'DELETE',
      }),
  };
}
