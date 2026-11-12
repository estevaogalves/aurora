package httpapi

import (
	"strings"
	"testing"

	"aurora/api/internal/domain"
)

func TestCheckInvoiceAdjustments(t *testing.T) {
	ok := []domain.InvoiceAdjustment{{ID: "a", Amount: -37, Note: "desconto"}, {ID: "b", Amount: 120}}
	if msg := checkInvoiceAdjustments(ok); msg != "" {
		t.Fatalf("lista válida recusada: %s", msg)
	}
	if msg := checkInvoiceAdjustments(nil); msg != "" {
		t.Fatalf("lista vazia deve ser aceita: %s", msg)
	}
	bad := map[string][]domain.InvoiceAdjustment{
		"sem id":   {{Amount: 5}},
		"repetido": {{ID: "a", Amount: 5}, {ID: "a", Amount: 6}},
		"zero":     {{ID: "a", Amount: 0}},
		"enorme":   {{ID: "a", Amount: domain.MaxInvestmentCents + 1}},
		"nota":     {{ID: "a", Amount: 1, Note: strings.Repeat("x", 201)}},
	}
	for name, list := range bad {
		if checkInvoiceAdjustments(list) == "" {
			t.Errorf("%s: deveria ser recusado", name)
		}
	}
	many := make([]domain.InvoiceAdjustment, 51)
	for i := range many {
		many[i] = domain.InvoiceAdjustment{ID: string(rune('a'+i%26)) + strings.Repeat("z", i), Amount: 1}
	}
	if checkInvoiceAdjustments(many) == "" {
		t.Error("mais de 50 ajustes deveria ser recusado")
	}
}
