package domain

import (
	"fmt"
	"strings"
	"time"
)

// RequiredDistributionIDs são as cinco fatias padrão, que não podem faltar.
var RequiredDistributionIDs = []string{"emergency", "invest", "leisure", "education", "costs"}

// ValidateDistribution devolve a mensagem do primeiro problema, ou "" se está válida:
// as cinco fatias padrão, nomes únicos, percentuais de 0 a 100 e soma exatamente 100.
func ValidateDistribution(items []DistributionItem) string {
	for _, id := range RequiredDistributionIDs {
		found := false
		for _, i := range items {
			if i.ID == id {
				found = true
				break
			}
		}
		if !found {
			return "As cinco categorias padrão são obrigatórias."
		}
	}

	names := map[string]bool{}
	total := 0
	for _, i := range items {
		name := strings.ToLower(strings.TrimSpace(i.Label))
		if name == "" {
			return "Toda categoria precisa de um nome."
		}
		if names[name] {
			return fmt.Sprintf("Há duas categorias chamadas %q.", strings.TrimSpace(i.Label))
		}
		names[name] = true
		if i.Percent < 0 || i.Percent > 100 {
			return fmt.Sprintf("O percentual de %q deve ser um número inteiro de 0 a 100.", strings.TrimSpace(i.Label))
		}
		total += i.Percent
	}
	if total != 100 {
		return fmt.Sprintf("Os percentuais somam %d%%. A soma precisa ser exatamente 100%%.", total)
	}
	return ""
}

// MaxDistGroup é o maior número de distribuição própria (Dist 20) que uma renda pode ter.
const MaxDistGroup = 20

// ValidOverrideKey confere a chave dos percentuais próprios de uma distribuição: "AAAA-MM|n" com n de 2 a 20.
func ValidOverrideKey(key string) bool {
	if len(key) < 9 || key[7] != '|' {
		return false
	}
	if _, err := time.Parse("2006-01", key[:7]); err != nil {
		return false
	}
	n := 0
	for _, r := range key[8:] {
		if r < '0' || r > '9' || n > MaxDistGroup {
			return false
		}
		n = n*10 + int(r-'0')
	}
	return n >= 2 && n <= MaxDistGroup
}
