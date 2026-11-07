package httpapi_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"aurora/api/internal/config"
)

// SEC-04 do lado da API: sem TRUST_PROXY, cabeçalhos de IP enviados pelo cliente são ignorados.
// Com TRUST_PROXY=true a API CONFIA neles; por isso o nginx precisa sobrescrevê-los (nginx-ip.test.ts)
// e a API não pode ser alcançável sem passar por ele.

func failedLogins(t *testing.T, e *env, email string, n int, header func(i int) (string, string)) []int {
	t.Helper()
	var codes []int
	for i := 0; i < n; i++ {
		body, _ := json.Marshal(map[string]string{"email": email, "password": "errada-errada"})
		req, _ := http.NewRequest("POST", e.srv.URL+"/api/v1/auth/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if header != nil {
			k, v := header(i)
			req.Header.Set(k, v)
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		codes = append(codes, res.StatusCode)
	}
	return codes
}

func TestForgedIPHeadersIgnoredWithoutTrustProxy(t *testing.T) {
	e := setup(t) // TrustProxy desligado; LoginMaxAttempts = 3
	for _, h := range []string{"X-Real-IP", "X-Forwarded-For", "True-Client-IP"} {
		email := fmt.Sprintf("forja-%s-%d@aurora.test", h, time.Now().UnixNano())
		codes := failedLogins(t, e, email, 5, func(i int) (string, string) { return h, fmt.Sprintf("203.0.113.%d", i+1) })
		want := []int{401, 401, 401, 429, 429}
		for i := range want {
			if codes[i] != want[i] {
				t.Fatalf("%s forjado: códigos %v, esperado %v", h, codes, want)
			}
		}
	}
}

func TestTrustProxyReadsRealIPHeader(t *testing.T) {
	e := setup(t, func(c *config.Config) { c.TrustProxy = true })

	// IPs diferentes têm contadores diferentes (é o que o nginx de produção entrega)...
	email := fmt.Sprintf("proxy-%d@aurora.test", time.Now().UnixNano())
	a := failedLogins(t, e, email, 4, func(int) (string, string) { return "X-Real-IP", "198.51.100.1" })
	if a[3] != 429 {
		t.Fatalf("o IP A deveria estar bloqueado: %v", a)
	}
	b := failedLogins(t, e, email, 1, func(int) (string, string) { return "X-Real-IP", "198.51.100.2" })
	if b[0] != 401 {
		t.Fatalf("o IP B não deveria estar bloqueado: %v", b)
	}
	// ...e é por isso que, com TRUST_PROXY=true, quem fala com a API sem o nginx consegue forjar o IP.
}
