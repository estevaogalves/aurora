import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUiStore } from "@/Store/UiStore";
import CreditCardsPanel from "./CreditCardsPanel";

/** Janela de Cartões de crédito, aberta pelo menu do perfil (ou pelo aviso do formulário Lançar). */
export default function CardsDialog() {
  const open = useUiStore((s) => s.cardsOpen);
  const close = useUiStore((s) => s.closeCards);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cartões de crédito</DialogTitle>
          <DialogDescription>Veja, edite e exclua seus cartões. Para cadastrar um novo, use o botão Lançar, na aba Cartão.</DialogDescription>
        </DialogHeader>
        <CreditCardsPanel />
      </DialogContent>
    </Dialog>
  );
}
