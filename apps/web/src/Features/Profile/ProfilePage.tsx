import { PageHeader } from "@/components/shared/Panel";
import CreditCardsPanel from "./CreditCardsPanel";

/** Cartões (só no modo local, onde não há menu de conta): ver, editar e excluir. O cadastro é no Lançar. */
export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Cartões de crédito" subtitle="Veja, edite e exclua seus cartões. Para cadastrar um novo, use o botão Lançar." />
      <CreditCardsPanel />
    </>
  );
}
