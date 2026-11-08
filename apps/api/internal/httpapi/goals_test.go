package httpapi_test

import "testing"

func TestPiggyGoalNeedsNoTarget(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken

	// meta comum continua exigindo valor
	want(t, e.do(t, "POST", "/api/v1/goals", tk, map[string]any{"name": "Viagem", "target": 0, "saved": 0, "monthly": 0, "deadline": nil}), 400)

	// porquinho: sem valor de meta, com aporte, guardado e prazo
	r := e.do(t, "POST", "/api/v1/goals", tk, map[string]any{"name": "Porquinho", "piggy": true, "target": 0, "saved": 5000, "monthly": 1000, "deadline": "2030-01"})
	want(t, r, 201)
	var g struct {
		ID    string `json:"id"`
		Piggy bool   `json:"piggy"`
		Saved int64  `json:"saved"`
	}
	r.json(t, &g)
	if !g.Piggy || g.Saved != 5000 {
		t.Fatalf("criado=%+v", g)
	}

	// o aporte (PATCH) segue a regra de sempre e o porquinho persiste
	want(t, e.do(t, "PATCH", "/api/v1/goals/"+g.ID, tk, map[string]any{"saved": 6000, "yieldTotal": 100}), 200)
	var data struct {
		Goals []struct {
			Piggy bool  `json:"piggy"`
			Saved int64 `json:"saved"`
		} `json:"goals"`
	}
	e.do(t, "GET", "/api/v1/data", tk, nil).json(t, &data)
	if len(data.Goals) != 1 || !data.Goals[0].Piggy || data.Goals[0].Saved != 6000 {
		t.Fatalf("dados=%+v", data.Goals)
	}
}
