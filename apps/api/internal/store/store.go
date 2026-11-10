// Package store é a camada de persistência: traduz entre as linhas do sqlc e o domínio.
// Toda consulta de dados do usuário recebe o userID, então um usuário nunca enxerga o de outro.
package store

import (
	"context"
	"encoding/json"
	"errors"
	"sort"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"aurora/api/internal/domain"
	"aurora/api/internal/store/sqlcgen"
)

var (
	ErrNotFound  = errors.New("não encontrado")
	ErrDuplicate = errors.New("já existe")
	ErrHasData   = errors.New("a conta já tem dados")
	ErrLastAdmin = errors.New("é o único admin")
)

type Store struct {
	pool *pgxpool.Pool
	q    *sqlcgen.Queries
}

func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool, q: sqlcgen.New(pool)} }

// Pool expõe o pool (healthcheck).
func (s *Store) Pool() *pgxpool.Pool { return s.pool }

func (s *Store) inTx(ctx context.Context, fn func(q *sqlcgen.Queries) error) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if err := fn(s.q.WithTx(tx)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func mapErr(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		return ErrDuplicate
	}
	return err
}

func notFoundIfZero(rows int64, err error) error {
	if err != nil {
		return mapErr(err)
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

func text(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func int8v(v *int64) pgtype.Int8 {
	if v == nil {
		return pgtype.Int8{}
	}
	return pgtype.Int8{Int64: *v, Valid: true}
}
func boolv(v *bool) pgtype.Bool {
	if v == nil {
		return pgtype.Bool{}
	}
	return pgtype.Bool{Bool: *v, Valid: true}
}

// clientID aproveita o id gerado pelo cliente (o front cria UUIDs e usa o mesmo id nas
// atualizações seguintes). Id ausente ou que não seja UUID vira uuid.Nil: o banco gera um.
func clientID(id string) uuid.UUID {
	u, err := uuid.Parse(id)
	if err != nil {
		return uuid.Nil
	}
	return u
}

func parseID(id string) (uuid.UUID, error) {
	u, err := uuid.Parse(id)
	if err != nil {
		return uuid.Nil, ErrNotFound
	}
	return u, nil
}

/* ---------- carregar tudo ---------- */

// LoadData devolve tudo do usuário, no formato que o front usa.
func (s *Store) LoadData(ctx context.Context, userID uuid.UUID) (domain.FinanceData, error) {
	var d domain.FinanceData

	txRows, err := s.q.ListTransactions(ctx, userID)
	if err != nil {
		return d, err
	}
	ovRows, err := s.q.ListOverrides(ctx, userID)
	if err != nil {
		return d, err
	}
	overrides := map[uuid.UUID][]sqlcgen.FixedOverride{}
	for _, o := range ovRows {
		overrides[o.TransactionID] = append(overrides[o.TransactionID], o)
	}
	for _, r := range txRows {
		d.Transactions = append(d.Transactions, transactionFrom(r, overrides[r.ID]))
	}

	credits, err := s.q.ListCredits(ctx, userID)
	if err != nil {
		return d, err
	}
	for _, r := range credits {
		d.CreditTransactions = append(d.CreditTransactions, creditFrom(r))
	}

	cards, err := s.q.ListCreditCards(ctx, userID)
	if err != nil {
		return d, err
	}
	for _, r := range cards {
		d.CreditCards = append(d.CreditCards, cardFrom(r))
	}

	notes, err := s.q.ListNotes(ctx, userID)
	if err != nil {
		return d, err
	}
	for _, r := range notes {
		d.Notes = append(d.Notes, noteFrom(r))
	}

	goals, err := s.q.ListGoals(ctx, userID)
	if err != nil {
		return d, err
	}
	for _, r := range goals {
		d.Goals = append(d.Goals, goalFrom(r))
	}

	extras, err := s.q.ListExtraExpenses(ctx, userID)
	if err != nil {
		return d, err
	}
	for _, r := range extras {
		d.ExtraExpenses = append(d.ExtraExpenses, extraFrom(r))
	}

	cats, err := s.q.ListCategories(ctx, userID)
	if err != nil {
		return d, err
	}
	for _, r := range cats {
		d.CustomCategories = append(d.CustomCategories, domain.CustomCategory{ID: r.ID.String(), Name: r.Name, Color: r.Color})
	}

	settings, err := s.q.GetSettings(ctx, userID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return d, err
	}
	if err == nil {
		d.SeenAlerts = settings.SeenAlerts
		if len(settings.Onboarding) > 0 {
			if err := json.Unmarshal(settings.Onboarding, &d.Onboarding); err != nil {
				return d, err
			}
		}
		if len(settings.Distribution) > 0 {
			if err := json.Unmarshal(settings.Distribution, &d.Distribution); err != nil {
				return d, err
			}
		}
	}

	d.Normalize()
	return d, nil
}

// IsEmpty diz se a conta ainda não tem nenhum dado.
func (s *Store) IsEmpty(ctx context.Context, userID uuid.UUID) (bool, error) {
	d, err := s.LoadData(ctx, userID)
	if err != nil {
		return false, err
	}
	return len(d.Transactions)+len(d.CreditTransactions)+len(d.Notes)+len(d.Goals)+
		len(d.ExtraExpenses)+len(d.CustomCategories) == 0, nil
}

/* ---------- linhas -> domínio ---------- */

func transactionFrom(r sqlcgen.Transaction, ov []sqlcgen.FixedOverride) domain.Transaction {
	t := domain.Transaction{
		ID: r.ID.String(), Name: r.Name, Amount: r.AmountCents, Type: r.Type,
		Category: r.Category, Notes: r.Notes, Fixed: r.Fixed, Month: r.Month,
	}
	if len(r.Payments) > 0 {
		_ = json.Unmarshal(r.Payments, &t.Payments)
	}
	if len(t.Payments) == 0 {
		t.Payments = nil
	}
	if len(r.MonthlyNotes) > 0 {
		_ = json.Unmarshal(r.MonthlyNotes, &t.MonthlyNotes)
	}
	if len(t.MonthlyNotes) == 0 {
		t.MonthlyNotes = nil
	}
	for _, o := range ov {
		if o.Hidden {
			t.HiddenMonths = append(t.HiddenMonths, o.Month)
		}
		if o.AmountCents.Valid {
			if t.MonthlyValues == nil {
				t.MonthlyValues = map[string]int64{}
			}
			t.MonthlyValues[o.Month] = o.AmountCents.Int64
		}
	}
	sort.Strings(t.HiddenMonths)
	return t
}

func creditFrom(r sqlcgen.CreditPurchase) domain.CreditTransaction {
	c := domain.CreditTransaction{
		ID: r.ID.String(), Name: r.Name, TotalAmount: r.TotalCents,
		Installments: int(r.Installments), StartMonth: r.StartMonth, Category: r.Category,
		Recurring: r.Recurring, EndMonth: r.EndMonth.String, BillingDay: int(r.BillingDay),
		VariableAmount: r.VariableAmount,
	}
	if r.CardID.Valid {
		c.CardID = r.CardID.UUID.String()
	}
	if len(r.Adjustments) > 0 {
		_ = json.Unmarshal(r.Adjustments, &c.Adjustments)
	}
	if len(c.Adjustments) == 0 {
		c.Adjustments = nil
	}
	return c
}

// ValidationError: a operação foi recusada por uma regra de negócio (a mensagem é segura para mostrar ao usuário).
type ValidationError struct{ Msg string }

func (e *ValidationError) Error() string { return e.Msg }

func cardFrom(r sqlcgen.CreditCard) domain.CreditCard {
	return domain.CreditCard{ID: r.ID.String(), Name: r.Name, ClosingDay: int(r.ClosingDay), DueDay: int(r.DueDay)}
}

func noteFrom(r sqlcgen.Note) domain.Note {
	return domain.Note{ID: r.ID.String(), Content: r.Content, Date: r.Date, Pinned: r.Pinned, Month: r.Month}
}

func goalFrom(r sqlcgen.Goal) domain.Goal {
	g := domain.Goal{
		ID: r.ID.String(), Name: r.Name, Target: r.TargetCents, Saved: r.SavedCents,
		Monthly: r.MonthlyCents, YieldTotal: r.YieldTotalCents, Piggy: r.Piggy,
	}
	if r.Deadline.Valid {
		d := r.Deadline.String
		g.Deadline = &d
	}
	return g
}

func extraFrom(r sqlcgen.ExtraExpense) domain.ExtraExpense {
	e := domain.ExtraExpense{ID: r.ID.String(), Name: r.Name, Amount: r.AmountCents, Month: r.Month}
	if len(r.Payment) > 0 && string(r.Payment) != "null" {
		var p domain.Payment
		if json.Unmarshal(r.Payment, &p) == nil {
			e.Payment = &p
		}
	}
	return e
}
