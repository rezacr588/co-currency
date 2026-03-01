import type { Tag, CreateTagRequest } from '../types/goal';
import { fetchAPI } from './base';
import { createCRUDApi } from './crud';

const crud = createCRUDApi<
  { tags: Tag[] },
  Tag,
  CreateTagRequest,
  Tag,
  Partial<CreateTagRequest>
>('/tags');

export const tags = {
  list: crud.list,
  create: crud.create,
  delete: crud.delete,
};
