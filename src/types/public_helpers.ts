
export interface ContextMenuItem<IdT, EntityIdT> {
  id: string;
  title: string;
  icon?: { [key in string]: string };
  urls?: (
    selectedIds: IdT[], 
    entityId: EntityIdT | null, 
    permissions: string[], 
    supports: string[]
  ) => string[] | undefined | Promise<string[] | undefined>;
  onClick?: (selectedIds: IdT[], entityId: EntityIdT | null, permissions: string[], supports: string[]) => void;
  filter?: (
    selectedIds: IdT[], 
    entityId: EntityIdT | null, 
    permissions: string[], 
    supports: string[]
  ) => boolean | Promise<boolean>;
  access?: string;
}