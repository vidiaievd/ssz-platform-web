export type ContainerStatus = 'draft' | 'published';

export interface AuthoringFilters {
  status?: ContainerStatus;
}
