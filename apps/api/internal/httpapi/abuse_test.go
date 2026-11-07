package httpapi_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"testing"
	"time"

	"aurora/api/internal/config"
)

// SEC-02: cadastro limitado por IP (429) e hashing limitado por fila com timeout (503).

func TestRegisterRateLimitPerIP(t *testing.T) {
	e := setup(t, func(c *config.Config) { c.RegisterMaxPerIP = 2; c.RegisterWindow = time.Hour })

	e.register(t, "")
	e.register(t, "")

	// pedido inválido não chega ao hash e não gasta o limite
	want(t, e.do(t, "POST", "/api/v1/auth/register", "", map[string]string{"email": "ruim", "password": "senha-forte-123"}), 400)

	r := e.do(t, "POST", "/api/v1/auth/register", "", map[string]string{"email": "terceiro@aurora.test", "name": "x", "password": "senha-forte-123"})
	want(t, r, 429)
	if r.Header.Get("Retry-After") == "" {
		t.Error("faltou o cabeçalho Retry-After")
	}

	// o login não é afetado pelo limite de cadastro
	want(t, e.do(t, "POST", "/api/v1/auth/login", "", map[string]string{"email": "naoexiste@aurora.test", "password": "x"}), 401)

	// a janela passa e libera
	e.mr.FastForward(2 * time.Hour)
	e.register(t, "")
}

func TestHashingOverloadReturns503(t *testing.T) {
	// 1 vaga, fila de 1, espera de 20 ms: com 12 pedidos simultâneos, a maioria é recusada
	e := setup(t, func(c *config.Config) {
		c.HashMaxConcurrency = 1
		c.HashMaxQueue = 1
		c.HashQueueTimeout = 20 * time.Millisecond
	})

	const n = 12
	var mu sync.Mutex
	codes := map[int]int{}
	var retryAfterMissing bool
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			body, _ := json.Marshal(map[string]string{
				"email": fmt.Sprintf("carga%d-%d@aurora.test", time.Now().UnixNano(), i), "name": "x", "password": "senha-forte-123",
			})
			res, err := http.Post(e.srv.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(body))
			if err != nil {
				t.Error(err)
				return
			}
			defer res.Body.Close()
			mu.Lock()
			codes[res.StatusCode]++
			if res.StatusCode == http.StatusServiceUnavailable && res.Header.Get("Retry-After") == "" {
				retryAfterMissing = true
			}
			mu.Unlock()
		}(i)
	}
	wg.Wait()

	if codes[http.StatusServiceUnavailable] == 0 {
		t.Fatalf("esperava ao menos um 503 sob sobrecarga, vieram %v", codes)
	}
	if codes[http.StatusCreated] == 0 {
		t.Fatalf("esperava ao menos um cadastro concluído, vieram %v", codes)
	}
	if codes[http.StatusCreated]+codes[http.StatusServiceUnavailable] != n {
		t.Fatalf("só 201 e 503 são esperados, vieram %v", codes)
	}
	if retryAfterMissing {
		t.Error("503 sem Retry-After")
	}

	// passada a rajada, o servidor volta ao normal
	e.register(t, "")
}
