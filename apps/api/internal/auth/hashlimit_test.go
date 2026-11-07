package auth

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestAutoConcurrency(t *testing.T) {
	const mib = 1 << 20
	cases := []struct {
		name string
		mem  uint64
		cpus int
		want int
	}{
		{"512 MiB, muitas CPUs", 512 * mib, 12, 3}, // 40% de 512 = 204 MiB = 3 hashes de 64 MiB
		{"1 GiB", 1024 * mib, 12, 6},
		{"256 MiB: nunca menos que 1", 256 * mib, 12, 1},
		{"64 MiB: ainda 1", 64 * mib, 8, 1},
		{"muita memória, poucas CPUs", 64 * 1024 * mib, 2, 2},
		{"memória desconhecida: no máximo 4", 0, 16, 4},
		{"memória desconhecida, 1 CPU", 0, 1, 1},
		{"CPUs inválidas", 1024 * mib, 0, 1},
		{"teto absoluto", 1 << 50, 1000, 64},
	}
	for _, c := range cases {
		if got := AutoConcurrency(c.mem, c.cpus); got != c.want {
			t.Errorf("%s: got %d, want %d", c.name, got, c.want)
		}
	}
}

func TestHashLimiterNeverExceedsConcurrency(t *testing.T) {
	l := NewHashLimiter(2, 100, 5*time.Second)
	var inFlight, peak atomic.Int64
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			rel, err := l.Acquire(context.Background())
			if err != nil {
				t.Error(err)
				return
			}
			n := inFlight.Add(1)
			for {
				p := peak.Load()
				if n <= p || peak.CompareAndSwap(p, n) {
					break
				}
			}
			time.Sleep(5 * time.Millisecond)
			inFlight.Add(-1)
			rel()
		}()
	}
	wg.Wait()
	if peak.Load() > 2 {
		t.Fatalf("pico de %d hashes simultâneos, o limite era 2", peak.Load())
	}
}

func TestHashLimiterTimeoutAndQueueFull(t *testing.T) {
	l := NewHashLimiter(1, 1, 50*time.Millisecond)
	hold, err := l.Acquire(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	// 1º espera na fila e estoura o tempo
	errCh := make(chan error, 1)
	go func() { _, err := l.Acquire(context.Background()); errCh <- err }()
	time.Sleep(10 * time.Millisecond)

	// 2º encontra a fila cheia: recusa na hora
	start := time.Now()
	if _, err := l.Acquire(context.Background()); !errors.Is(err, ErrBusy) {
		t.Fatalf("fila cheia deveria dar ErrBusy, deu %v", err)
	}
	if time.Since(start) > 30*time.Millisecond {
		t.Error("com a fila cheia a recusa deveria ser imediata")
	}
	if err := <-errCh; !errors.Is(err, ErrBusy) {
		t.Fatalf("timeout deveria dar ErrBusy, deu %v", err)
	}

	// liberando a vaga, volta a funcionar
	hold()
	rel, err := l.Acquire(context.Background())
	if err != nil {
		t.Fatalf("depois de liberar deveria entrar: %v", err)
	}
	rel()
}

func TestHashLimiterContextCancel(t *testing.T) {
	l := NewHashLimiter(1, 5, time.Minute)
	hold, _ := l.Acquire(context.Background())
	defer hold()
	ctx, cancel := context.WithCancel(context.Background())
	go func() { time.Sleep(10 * time.Millisecond); cancel() }()
	if _, err := l.Acquire(ctx); !errors.Is(err, context.Canceled) {
		t.Fatalf("esperava context.Canceled, veio %v", err)
	}
}

func TestHashLimiterHashAndVerify(t *testing.T) {
	l := NewHashLimiter(1, 1, time.Second)
	h, err := l.Hash(context.Background(), "senha-forte-123")
	if err != nil {
		t.Fatal(err)
	}
	if ok, err := l.Verify(context.Background(), "senha-forte-123", h); err != nil || !ok {
		t.Fatalf("verify: %v %v", ok, err)
	}
	if ok, _ := l.Verify(context.Background(), "errada", h); ok {
		t.Fatal("senha errada não pode passar")
	}
}

func TestRateLimiterHit(t *testing.T) {
	rdb, mr := newRedis(t)
	l := NewRateLimiter(rdb, "register", 2, time.Hour)
	ctx := context.Background()
	for i := 0; i < 2; i++ {
		if ok, _, err := l.Hit(ctx, "1.1.1.1"); err != nil || !ok {
			t.Fatalf("tentativa %d deveria passar: %v %v", i+1, ok, err)
		}
	}
	ok, wait, _ := l.Hit(ctx, "1.1.1.1")
	if ok || wait <= 0 || wait > time.Hour {
		t.Fatalf("3ª deveria bloquear: ok=%v wait=%v", ok, wait)
	}
	if ok, _, _ := l.Hit(ctx, "2.2.2.2"); !ok {
		t.Error("outro IP não pode ser afetado")
	}
	mr.FastForward(2 * time.Hour)
	if ok, _, _ := l.Hit(ctx, "1.1.1.1"); !ok {
		t.Error("deveria liberar depois da janela")
	}
}
