import type { ComponentProps } from "react";

import SkillBuilderDrawer from "@/features/skills/components/SkillBuilderDrawer";
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog";
import { NamePromptDialog } from "../../../../shared/components/NamePromptDialog";
import { ShareSavedQueryModal } from "../../../../shared/components/saved-queries/ShareSavedQueryModal";
import { SaveQueryModal } from "./SaveQueryModal";
import { MoveModalDialog } from "./MoveModalDialog";

type QueryForgePageDialogsProps = {
  saveModalProps: ComponentProps<typeof SaveQueryModal>;
  skillDrawerProps: ComponentProps<typeof SkillBuilderDrawer>;
  skillDeleteDialogProps: ComponentProps<typeof ConfirmDialog>;
  nameDialogProps: ComponentProps<typeof NamePromptDialog>;
  moveModalProps: ComponentProps<typeof MoveModalDialog>;
  shareModalProps: ComponentProps<typeof ShareSavedQueryModal>;
};

export function QueryForgePageDialogs({
  saveModalProps,
  skillDrawerProps,
  skillDeleteDialogProps,
  nameDialogProps,
  moveModalProps,
  shareModalProps,
}: QueryForgePageDialogsProps) {
  return (
    <>
      <SaveQueryModal {...saveModalProps} />
      <SkillBuilderDrawer {...skillDrawerProps} />
      <ConfirmDialog {...skillDeleteDialogProps} />
      <NamePromptDialog {...nameDialogProps} />
      <MoveModalDialog {...moveModalProps} />
      <ShareSavedQueryModal {...shareModalProps} />
    </>
  );
}
