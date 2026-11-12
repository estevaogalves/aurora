package store

import (
	"context"

	"github.com/google/uuid"

	"aurora/api/internal/domain"
	"aurora/api/internal/store/sqlcgen"
)

// Comprovantes: arquivos pequenos (imagem ou PDF) anexados a um lançamento. Só anexos: nada aqui mexe em valores.

func receiptMetaFrom(r sqlcgen.ListReceiptsRow) domain.ReceiptMeta {
	return domain.ReceiptMeta{
		ID: r.ID.String(), TransactionID: r.TransactionID.String(), Name: r.Name, Mime: r.Mime,
		Size: int(r.SizeBytes), CreatedAt: r.CreatedAt.Time.Format("2006-01-02"),
	}
}

// ListReceipts devolve os dados dos comprovantes da conta (sem o conteúdo).
func (s *Store) ListReceipts(ctx context.Context, userID uuid.UUID) ([]domain.ReceiptMeta, error) {
	rows, err := s.q.ListReceipts(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]domain.ReceiptMeta, 0, len(rows))
	for _, r := range rows {
		out = append(out, receiptMetaFrom(r))
	}
	return out, nil
}

// CreateReceipt anexa o arquivo a um lançamento da conta. Confere o dono do lançamento e o máximo por lançamento
// na mesma transação.
func (s *Store) CreateReceipt(ctx context.Context, userID uuid.UUID, transactionID, name, mime string, data []byte) (domain.ReceiptMeta, error) {
	tid, err := parseID(transactionID)
	if err != nil {
		return domain.ReceiptMeta{}, err
	}
	var out domain.ReceiptMeta
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		if _, err := q.GetTransaction(ctx, sqlcgen.GetTransactionParams{ID: tid, UserID: userID}); err != nil {
			return err
		}
		n, err := q.CountReceiptsOfTransaction(ctx, sqlcgen.CountReceiptsOfTransactionParams{UserID: userID, TransactionID: tid})
		if err != nil {
			return err
		}
		if n >= domain.MaxReceiptsPerTransaction {
			return &ValidationError{Msg: "Cada lançamento aceita no máximo 5 comprovantes."}
		}
		row, err := q.CreateReceipt(ctx, sqlcgen.CreateReceiptParams{
			Column1: uuid.Nil, UserID: userID, TransactionID: tid, Name: name, Mime: mime, SizeBytes: int32(len(data)), Data: data,
		})
		if err != nil {
			return err
		}
		out = receiptMetaFrom(sqlcgen.ListReceiptsRow(row))
		return nil
	})
	return out, mapErr(err)
}

// GetReceipt devolve o conteúdo de um comprovante da conta.
func (s *Store) GetReceipt(ctx context.Context, userID uuid.UUID, id string) (domain.ReceiptMeta, []byte, error) {
	rid, err := parseID(id)
	if err != nil {
		return domain.ReceiptMeta{}, nil, err
	}
	row, err := s.q.GetReceipt(ctx, sqlcgen.GetReceiptParams{ID: rid, UserID: userID})
	if err != nil {
		return domain.ReceiptMeta{}, nil, mapErr(err)
	}
	meta := receiptMetaFrom(sqlcgen.ListReceiptsRow{ID: row.ID, TransactionID: row.TransactionID, Name: row.Name, Mime: row.Mime, SizeBytes: row.SizeBytes, CreatedAt: row.CreatedAt})
	return meta, row.Data, nil
}

// DeleteReceipt apaga um comprovante da conta.
func (s *Store) DeleteReceipt(ctx context.Context, userID uuid.UUID, id string) error {
	rid, err := parseID(id)
	if err != nil {
		return err
	}
	return notFoundIfZero(s.q.DeleteReceipt(ctx, sqlcgen.DeleteReceiptParams{ID: rid, UserID: userID}))
}
