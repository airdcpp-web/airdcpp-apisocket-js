
export interface ContextMenuItem<IdT, EntityIdT> {
  id: string;
  title: string;
  icon?: { [key in string]: string };
  onClick: (selectedIds: IdT[], entityId: EntityIdT | null, permissions: string[]) => void;
  filter?: (selectedIds: IdT[], entityId: EntityIdT | null, permissions: string[]) => boolean | Promise<boolean>;
  access?: string;
}