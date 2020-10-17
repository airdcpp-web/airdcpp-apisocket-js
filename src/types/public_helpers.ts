
type AsyncCallbackProperty<IdT, EntityIdT, ReturnT> = (
  selectedIds: IdT[], 
  entityId: EntityIdT | null, 
  permissions: string[], 
  supports: string[]
) => ReturnT | Promise<ReturnT>;

export interface ContextMenuItem<IdT, EntityIdT> {
  id: string;
  title: string;
  icon?: { [key in string]: string };
  urls?: string[] | AsyncCallbackProperty<IdT, EntityIdT, string[] | undefined>;
  onClick?: (
    selectedIds: IdT[], 
    entityId: EntityIdT | null, 
    permissions: string[], 
    supports: string[],
    formValues: object
  ) => void;
  filter?: AsyncCallbackProperty<IdT, EntityIdT, boolean>;
  access?: string;
  formDefinitions?: object[] | AsyncCallbackProperty<IdT, EntityIdT, object[]>;
}