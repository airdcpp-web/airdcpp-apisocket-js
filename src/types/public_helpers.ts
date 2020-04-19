
export interface ContextMenuItem<IdT, EntityIdT> {
  id: string;
  title: string;
  icon?: { [key in string]: string };
  onClick: (selectedIds: IdT[], entityId: EntityIdT | null) => void;
  filter?: (selectedIds: IdT[], entityId: EntityIdT | null) => boolean | Promise<boolean>;
}