package store

import (
	"context"
	"database/sql"

	"github.com/google/uuid"

	"aurora/api/internal/domain"
	"aurora/api/internal/store/sqlcgen"
)

/* ---------- investimentos ---------- */

// InvestmentPatch: só os campos preenchidos mudam. Cotas e preço médio são os únicos que podem ser
// limpos: SetQuantity/SetAvgPrice dizem que vieram na requisição, e o valor nil limpa.
type InvestmentPatch struct {
	Name, Family, Product, Institution, AppliedAt        *string
	CurrentValue                                         *int64
	MaturityDate, Indexer, Rate, Liquidity, GraceUntil   *string
	EarlyRedeem                                          *bool
	RedeemDays                                           *int
	Ticker, Fees, Notes                                  *string
	SetQuantity                                          bool
	Quantity                                             *float64
	SetAvgPrice                                          bool
	AvgPrice                                             *int64
}

// MovementPatch: Type, Date e Amount só mudam se vierem; Quantity e UnitPrice podem ser limpos (veja InvestmentPatch).
type MovementPatch struct {
	Type, Date   *string
	Note, Origin *string
	Amount       *int64
	SetQuantity  bool
	Quantity     *float64
	SetUnitPrice bool
	UnitPrice    *int64
}

func nullInt8(v *int64) sql.NullInt64 { return int8v(v) }

func investmentFrom(r sqlcgen.Investment) domain.Investment {
	inv := domain.Investment{
		ID: r.ID.String(), Name: r.Name, Family: r.Family, Product: r.Product, Institution: r.Institution,
		AppliedAt: r.AppliedAt, CurrentValue: r.CurrentValueCents, MaturityDate: r.MaturityDate,
		Indexer: r.Indexer, Rate: r.Rate, Liquidity: r.Liquidity, GraceUntil: r.GraceUntil,
		EarlyRedeem: r.EarlyRedeem, Quantity: r.Quantity, RedeemDays: int(r.RedeemDays),
		Ticker: r.Ticker, Fees: r.Fees, Notes: r.Notes,
	}
	if r.AvgPriceCents.Valid {
		v := r.AvgPriceCents.Int64
		inv.AvgPrice = &v
	}
	return inv
}

func movementFrom(r sqlcgen.InvestmentMovement) domain.InvestmentMovement {
	m := domain.InvestmentMovement{
		ID: r.ID.String(), InvestmentID: r.InvestmentID.String(), Type: r.Type, Date: r.Date,
		Amount: r.AmountCents, Quantity: r.Quantity, Note: r.Note, Origin: r.Origin,
	}
	if r.UnitPriceCents.Valid {
		v := r.UnitPriceCents.Int64
		m.UnitPrice = &v
	}
	return m
}

func investmentParams(userID uuid.UUID, id uuid.UUID, inv domain.Investment) sqlcgen.CreateInvestmentParams {
	p := sqlcgen.CreateInvestmentParams{
		ID: id, UserID: userID, Name: inv.Name, Family: inv.Family, Product: inv.Product,
		Institution: inv.Institution, AppliedAt: inv.AppliedAt, CurrentValueCents: inv.CurrentValue,
		MaturityDate: inv.MaturityDate, Indexer: inv.Indexer, Rate: inv.Rate, Liquidity: inv.Liquidity,
		GraceUntil: inv.GraceUntil, EarlyRedeem: inv.EarlyRedeem, Quantity: inv.Quantity,
		AvgPriceCents: nullInt8(inv.AvgPrice), RedeemDays: int64(inv.RedeemDays),
		Ticker: inv.Ticker, Fees: inv.Fees, Notes: inv.Notes,
	}
	return p
}

func (s *Store) CreateInvestment(ctx context.Context, userID uuid.UUID, inv domain.Investment) (domain.Investment, error) {
	row, err := s.q.CreateInvestment(ctx, investmentParams(userID, clientID(inv.ID), inv))
	return investmentFrom(row), mapErr(err)
}

func (s *Store) UpdateInvestment(ctx context.Context, userID uuid.UUID, id string, p InvestmentPatch) (domain.Investment, error) {
	iid, err := parseID(id)
	if err != nil {
		return domain.Investment{}, err
	}
	arg := sqlcgen.UpdateInvestmentParams{
		Name: text(p.Name), Family: text(p.Family), Product: text(p.Product), Institution: text(p.Institution),
		AppliedAt: text(p.AppliedAt), CurrentValueCents: int8v(p.CurrentValue), MaturityDate: text(p.MaturityDate),
		Indexer: text(p.Indexer), Rate: text(p.Rate), Liquidity: text(p.Liquidity), GraceUntil: text(p.GraceUntil),
		EarlyRedeem: boolv(p.EarlyRedeem), Ticker: text(p.Ticker), Fees: text(p.Fees), Notes: text(p.Notes),
		ID: iid, UserID: userID,
	}
	if p.RedeemDays != nil {
		arg.RedeemDays.Int64, arg.RedeemDays.Valid = int64(*p.RedeemDays), true
	}
	var out domain.Investment
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		row, err := q.UpdateInvestment(ctx, arg)
		if err != nil {
			return err
		}
		// cotas e preço médio só mudam quando vieram na requisição (nil limpa): no SQLite são consultas à parte
		if p.SetQuantity {
			if row, err = q.SetInvestmentQuantity(ctx, sqlcgen.SetInvestmentQuantityParams{Quantity: p.Quantity, ID: iid, UserID: userID}); err != nil {
				return err
			}
		}
		if p.SetAvgPrice {
			if row, err = q.SetInvestmentAvgPrice(ctx, sqlcgen.SetInvestmentAvgPriceParams{AvgPriceCents: nullInt8(p.AvgPrice), ID: iid, UserID: userID}); err != nil {
				return err
			}
		}
		out = investmentFrom(row)
		return nil
	})
	return out, mapErr(err)
}

// DeleteInvestment apaga o investimento e as movimentações dele (ON DELETE CASCADE).
func (s *Store) DeleteInvestment(ctx context.Context, userID uuid.UUID, id string) error {
	iid, err := parseID(id)
	if err != nil {
		return err
	}
	return notFoundIfZero(s.q.DeleteInvestment(ctx, sqlcgen.DeleteInvestmentParams{ID: iid, UserID: userID}))
}

/* ---------- movimentações ---------- */

// refreshInvestment refaz valor atual, cotas e preço médio pelas movimentações (domain.ReplayInvestment) e
// grava no investimento. Roda dentro da mesma transação da movimentação, com o investimento travado, então
// duas movimentações ao mesmo tempo não se atropelam.
func refreshInvestment(ctx context.Context, q *sqlcgen.Queries, userID, investmentID uuid.UUID) (domain.Investment, error) {
	cur, err := q.GetInvestmentForUpdate(ctx, sqlcgen.GetInvestmentForUpdateParams{ID: investmentID, UserID: userID})
	if err != nil {
		return domain.Investment{}, err
	}
	rows, err := q.ListMovementsOfInvestment(ctx, sqlcgen.ListMovementsOfInvestmentParams{InvestmentID: investmentID, UserID: userID})
	if err != nil {
		return domain.Investment{}, err
	}
	movements := make([]domain.InvestmentMovement, 0, len(rows))
	for _, r := range rows {
		movements = append(movements, movementFrom(r))
	}
	next := domain.ReplayInvestment(investmentFrom(cur), movements)
	row, err := q.SetInvestmentDerived(ctx, sqlcgen.SetInvestmentDerivedParams{
		ID: investmentID, UserID: userID, CurrentValueCents: next.CurrentValue, Quantity: next.Quantity, AvgPriceCents: nullInt8(next.AvgPrice),
	})
	return investmentFrom(row), err
}

// CreateInvestmentMovement registra a movimentação e atualiza o investimento na mesma transação.
func (s *Store) CreateInvestmentMovement(ctx context.Context, userID uuid.UUID, m domain.InvestmentMovement) (domain.InvestmentMovement, domain.Investment, error) {
	iid, err := parseID(m.InvestmentID)
	if err != nil {
		return domain.InvestmentMovement{}, domain.Investment{}, err
	}
	var outM domain.InvestmentMovement
	var outI domain.Investment
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		// trava o investimento (e confere o dono) antes de inserir
		if _, err := q.GetInvestmentForUpdate(ctx, sqlcgen.GetInvestmentForUpdateParams{ID: iid, UserID: userID}); err != nil {
			return mapErr(err)
		}
		row, err := q.CreateInvestmentMovement(ctx, sqlcgen.CreateInvestmentMovementParams{
			ID: clientID(m.ID), UserID: userID, InvestmentID: iid, Type: m.Type, Date: m.Date,
			AmountCents: m.Amount, Quantity: m.Quantity, UnitPriceCents: nullInt8(m.UnitPrice), Note: m.Note, Origin: m.Origin,
		})
		if err != nil {
			return err
		}
		if outI, err = refreshInvestment(ctx, q, userID, iid); err != nil {
			return err
		}
		outM = movementFrom(row)
		return nil
	})
	return outM, outI, mapErr(err)
}

// UpdateInvestmentMovement corrige a movimentação e refaz o investimento na mesma transação.
func (s *Store) UpdateInvestmentMovement(ctx context.Context, userID uuid.UUID, id string, p MovementPatch) (domain.InvestmentMovement, domain.Investment, error) {
	mid, err := parseID(id)
	if err != nil {
		return domain.InvestmentMovement{}, domain.Investment{}, err
	}
	var outM domain.InvestmentMovement
	var outI domain.Investment
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		cur, err := q.GetInvestmentMovementForUpdate(ctx, sqlcgen.GetInvestmentMovementForUpdateParams{ID: mid, UserID: userID})
		if err != nil {
			return mapErr(err)
		}
		if _, err := q.GetInvestmentForUpdate(ctx, sqlcgen.GetInvestmentForUpdateParams{ID: cur.InvestmentID, UserID: userID}); err != nil {
			return err
		}
		row, err := q.UpdateInvestmentMovement(ctx, sqlcgen.UpdateInvestmentMovementParams{
			Type: text(p.Type), Date: text(p.Date), AmountCents: int8v(p.Amount), Note: text(p.Note), Origin: text(p.Origin),
			ID: mid, UserID: userID,
		})
		if err != nil {
			return err
		}
		// cotas e preço por cota só mudam quando vieram na requisição (nil limpa): no SQLite são consultas à parte
		if p.SetQuantity {
			if row, err = q.SetInvestmentMovementQuantity(ctx, sqlcgen.SetInvestmentMovementQuantityParams{Quantity: p.Quantity, ID: mid, UserID: userID}); err != nil {
				return err
			}
		}
		if p.SetUnitPrice {
			if row, err = q.SetInvestmentMovementUnitPrice(ctx, sqlcgen.SetInvestmentMovementUnitPriceParams{UnitPriceCents: nullInt8(p.UnitPrice), ID: mid, UserID: userID}); err != nil {
				return err
			}
		}
		if outI, err = refreshInvestment(ctx, q, userID, cur.InvestmentID); err != nil {
			return err
		}
		outM = movementFrom(row)
		return nil
	})
	return outM, outI, mapErr(err)
}

// DeleteInvestmentMovement apaga a movimentação e refaz o investimento na mesma transação.
func (s *Store) DeleteInvestmentMovement(ctx context.Context, userID uuid.UUID, id string) (domain.Investment, error) {
	mid, err := parseID(id)
	if err != nil {
		return domain.Investment{}, err
	}
	var out domain.Investment
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		cur, err := q.GetInvestmentMovementForUpdate(ctx, sqlcgen.GetInvestmentMovementForUpdateParams{ID: mid, UserID: userID})
		if err != nil {
			return mapErr(err)
		}
		if _, err := q.GetInvestmentForUpdate(ctx, sqlcgen.GetInvestmentForUpdateParams{ID: cur.InvestmentID, UserID: userID}); err != nil {
			return err
		}
		if err := notFoundIfZero(q.DeleteInvestmentMovement(ctx, sqlcgen.DeleteInvestmentMovementParams{ID: mid, UserID: userID})); err != nil {
			return err
		}
		out, err = refreshInvestment(ctx, q, userID, cur.InvestmentID)
		return err
	})
	return out, mapErr(err)
}
