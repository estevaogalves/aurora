package store

import (
	"context"
	"time"

	"github.com/google/uuid"

	"aurora/api/internal/domain"
	"aurora/api/internal/store/sqlcgen"
)

/* ---------- histórico de metas e porquinhos ---------- */

// GoalMovementPatch: só os campos preenchidos mudam.
type GoalMovementPatch struct {
	Type, Date   *string
	Amount       *int64
	Note, Origin *string
}

func goalMovementFrom(r sqlcgen.GoalMovement) domain.GoalMovement {
	return domain.GoalMovement{
		ID: r.ID.String(), GoalID: r.GoalID.String(), Type: r.Type, Date: r.Date,
		Amount: r.AmountCents, Note: r.Note, Origin: r.Origin,
	}
}

func today() string { return time.Now().UTC().Format("2006-01-02") }

// refreshGoal refaz o guardado e o total de rendimentos pelas movimentações (domain.ReplayGoal) e grava na meta.
// Roda dentro da mesma transação da movimentação, com a meta travada, então duas movimentações ao mesmo tempo
// não se atropelam.
func refreshGoal(ctx context.Context, q *sqlcgen.Queries, userID, goalID uuid.UUID) (domain.Goal, error) {
	cur, err := q.GetGoalForUpdate(ctx, sqlcgen.GetGoalForUpdateParams{ID: goalID, UserID: userID})
	if err != nil {
		return domain.Goal{}, err
	}
	rows, err := q.ListMovementsOfGoal(ctx, sqlcgen.ListMovementsOfGoalParams{GoalID: goalID, UserID: userID})
	if err != nil {
		return domain.Goal{}, err
	}
	movements := make([]domain.GoalMovement, 0, len(rows))
	for _, r := range rows {
		movements = append(movements, goalMovementFrom(r))
	}
	next := domain.ReplayGoal(goalFrom(cur), movements)
	row, err := q.SetGoalDerived(ctx, sqlcgen.SetGoalDerivedParams{ID: goalID, UserID: userID, SavedCents: next.Saved, YieldTotalCents: next.YieldTotal})
	return goalFrom(row), err
}

// insertGoalOpening dá a uma meta o começo de histórico que reproduz o que ela já tinha guardado: primeiro os
// rendimentos (que somam no guardado e no total de rendimentos) e depois um ajuste que define o guardado.
func insertGoalOpening(ctx context.Context, q *sqlcgen.Queries, userID, goalID uuid.UUID, saved, yield int64, date string) error {
	if saved <= 0 && yield <= 0 {
		return nil
	}
	if yield > 0 {
		if _, err := q.CreateGoalMovement(ctx, sqlcgen.CreateGoalMovementParams{
			UserID: userID, GoalID: goalID, Type: domain.GoalYield, Date: date, AmountCents: yield, Note: "Rendimentos até aqui",
		}); err != nil {
			return err
		}
	}
	_, err := q.CreateGoalMovement(ctx, sqlcgen.CreateGoalMovementParams{
		UserID: userID, GoalID: goalID, Type: domain.GoalAdjustment, Date: date, AmountCents: saved, Note: "Saldo inicial",
	})
	return err
}

// CreateGoalMovement registra a movimentação e refaz a meta na mesma transação.
func (s *Store) CreateGoalMovement(ctx context.Context, userID uuid.UUID, m domain.GoalMovement) (domain.GoalMovement, domain.Goal, error) {
	gid, err := parseID(m.GoalID)
	if err != nil {
		return domain.GoalMovement{}, domain.Goal{}, err
	}
	var outM domain.GoalMovement
	var outG domain.Goal
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		// trava a meta (e confere o dono) antes de inserir
		if _, err := q.GetGoalForUpdate(ctx, sqlcgen.GetGoalForUpdateParams{ID: gid, UserID: userID}); err != nil {
			return mapErr(err)
		}
		row, err := q.CreateGoalMovement(ctx, sqlcgen.CreateGoalMovementParams{
			Column1: clientID(m.ID), UserID: userID, GoalID: gid, Type: m.Type, Date: m.Date,
			AmountCents: m.Amount, Note: m.Note, Origin: m.Origin,
		})
		if err != nil {
			return err
		}
		if outG, err = refreshGoal(ctx, q, userID, gid); err != nil {
			return err
		}
		outM = goalMovementFrom(row)
		return nil
	})
	return outM, outG, mapErr(err)
}

// UpdateGoalMovement corrige a movimentação e refaz a meta na mesma transação.
func (s *Store) UpdateGoalMovement(ctx context.Context, userID uuid.UUID, id string, p GoalMovementPatch) (domain.GoalMovement, domain.Goal, error) {
	mid, err := parseID(id)
	if err != nil {
		return domain.GoalMovement{}, domain.Goal{}, err
	}
	var outM domain.GoalMovement
	var outG domain.Goal
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		cur, err := q.GetGoalMovementForUpdate(ctx, sqlcgen.GetGoalMovementForUpdateParams{ID: mid, UserID: userID})
		if err != nil {
			return mapErr(err)
		}
		if _, err := q.GetGoalForUpdate(ctx, sqlcgen.GetGoalForUpdateParams{ID: cur.GoalID, UserID: userID}); err != nil {
			return err
		}
		row, err := q.UpdateGoalMovement(ctx, sqlcgen.UpdateGoalMovementParams{
			Type: text(p.Type), Date: text(p.Date), AmountCents: int8v(p.Amount), Note: text(p.Note), Origin: text(p.Origin),
			ID: mid, UserID: userID,
		})
		if err != nil {
			return err
		}
		if outG, err = refreshGoal(ctx, q, userID, cur.GoalID); err != nil {
			return err
		}
		outM = goalMovementFrom(row)
		return nil
	})
	return outM, outG, mapErr(err)
}

// DeleteGoalMovement apaga a movimentação e refaz a meta na mesma transação.
func (s *Store) DeleteGoalMovement(ctx context.Context, userID uuid.UUID, id string) (domain.Goal, error) {
	mid, err := parseID(id)
	if err != nil {
		return domain.Goal{}, err
	}
	var out domain.Goal
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		cur, err := q.GetGoalMovementForUpdate(ctx, sqlcgen.GetGoalMovementForUpdateParams{ID: mid, UserID: userID})
		if err != nil {
			return mapErr(err)
		}
		if _, err := q.GetGoalForUpdate(ctx, sqlcgen.GetGoalForUpdateParams{ID: cur.GoalID, UserID: userID}); err != nil {
			return err
		}
		if err := notFoundIfZero(q.DeleteGoalMovement(ctx, sqlcgen.DeleteGoalMovementParams{ID: mid, UserID: userID})); err != nil {
			return err
		}
		out, err = refreshGoal(ctx, q, userID, cur.GoalID)
		return err
	})
	return out, mapErr(err)
}
