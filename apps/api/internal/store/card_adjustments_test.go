package store

import (
	"testing"

	"aurora/api/internal/domain"
)

func TestParseCardAdjustments(t *testing.T) {
	t.Run("lista nova", func(t *testing.T) {
		got := parseCardAdjustments([]byte(`{"2026-12":[{"id":"a","amount":-37,"note":"desconto"},{"id":"b","amount":120}]}`))
		if len(got["2026-12"]) != 2 || got["2026-12"][0].Amount != -37 || got["2026-12"][1].ID != "b" {
			t.Fatalf("lista errada: %+v", got)
		}
	})
	t.Run("formato antigo vira lista de um item", func(t *testing.T) {
		got := parseCardAdjustments([]byte(`{"2026-12":{"amount":-37,"note":"antigo"}}`))
		if len(got["2026-12"]) != 1 || got["2026-12"][0].Amount != -37 || got["2026-12"][0].ID == "" {
			t.Fatalf("formato antigo não lido: %+v", got)
		}
	})
	t.Run("vazio, lixo e zero", func(t *testing.T) {
		for _, raw := range []string{"", "{}", "nao-json", `{"2026-12":[]}`, `{"2026-12":{"amount":0}}`} {
			if got := parseCardAdjustments([]byte(raw)); len(got) != 0 {
				t.Fatalf("%q deveria dar vazio: %+v", raw, got)
			}
		}
	})
	t.Run("ida e volta", func(t *testing.T) {
		in := map[string][]domain.InvoiceAdjustment{"2026-12": {{ID: "a", Amount: -5}}}
		out := parseCardAdjustments(cardAdjustments(in))
		if len(out["2026-12"]) != 1 || out["2026-12"][0] != in["2026-12"][0] {
			t.Fatalf("ida e volta: %+v", out)
		}
	})
}
