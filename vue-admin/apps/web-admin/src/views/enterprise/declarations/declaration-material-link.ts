import {
  getMaterialSectionTarget,
  type MaterialSectionTarget,
} from '../workspace/materials/material-section';

interface DeclarationMaterialCheckItem {
  moduleKey?: string;
  tabKey?: string;
}

export function getDeclarationMaterialTarget(
  item: DeclarationMaterialCheckItem,
): MaterialSectionTarget | undefined {
  return getMaterialSectionTarget(item.moduleKey, item.tabKey);
}
