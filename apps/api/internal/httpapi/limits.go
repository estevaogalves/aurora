package httpapi

import "aurora/api/internal/config"

// Limits reúne os tetos de requisição. Os padrões vêm do maior volume legítimo que o app gera:
//   - a importação sai do localStorage do navegador (limite de ~5 MiB; ~250 B por lançamento => ~20 mil),
//     então 25 mil itens por coleção e 10 MiB de corpo cobrem qualquer uso real;
//   - uma despesa fixa ganha 1 entrada em monthlyValues/hiddenMonths por mês editado: 600 = 50 anos;
//   - a requisição comum maior (uma fixa com 600 meses) tem ~16 KB: 256 KiB dá folga de mais de 10x;
//   - a distribuição do saldo tem 5 fatias fixas e as do usuário (nome de até 30 caracteres): 50 sobra.
//
// Todos são configuráveis (MAX_BODY_BYTES, MAX_IMPORT_BYTES, MAX_IMPORT_ITEMS, MAX_MONTH_OVERRIDES,
// MAX_CUSTOM_CATEGORIES, MAX_DISTRIBUTION_ITEMS). Valor 0 na Config (usado nos testes) = padrão.
//
// Estes tetos limitam o tamanho de UMA requisição. Não são cota por usuário (decisão de escopo, risco
// residual registrado em docs/security).
type Limits struct {
	Body, ImportBody  int64
	ImportItems       int
	MonthOverrides    int
	CustomCategories  int
	DistributionItems int
	SeenAlerts        int
}

func limitsFrom(c config.Config) Limits {
	pick := func(v, def int) int {
		if v > 0 {
			return v
		}
		return def
	}
	pick64 := func(v, def int64) int64 {
		if v > 0 {
			return v
		}
		return def
	}
	return Limits{
		Body:              pick64(c.MaxBodyBytes, 256<<10),
		ImportBody:        pick64(c.MaxImportBytes, 10<<20),
		ImportItems:       pick(c.MaxImportItems, 25000),
		MonthOverrides:    pick(c.MaxMonthOverrides, 600),
		CustomCategories:  pick(c.MaxCustomCategories, 200),
		DistributionItems: pick(c.MaxDistributionItems, 50),
		SeenAlerts:        1000, // o mesmo teto de PUT /settings/seen-alerts
	}
}
