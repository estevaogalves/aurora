package auth

import (
	"context"
	"errors"
	"sync/atomic"
	"time"
)

// ErrBusy: não coube na fila de hashing (cheia ou estourou o tempo de espera). Responda 503.
var ErrBusy = errors.New("servidor ocupado")

const (
	argonMemoryBytes = uint64(argonMemory) * 1024
	// Parte do limite de memória reservada para hashes simultâneos. O resto fica para heap normal,
	// lixo ainda não coletado (cada hash aloca 64 MiB novos) e as demais goroutines.
	hashMemoryShare = 0.4
	maxHashSlots    = 64
)

// AutoConcurrency calcula quantos hashes argon2id podem rodar ao mesmo tempo sem estourar a memória
// nem passar do número de CPUs. memLimit 0 = desconhecido (assume no máximo 4). Sem reduzir os
// parâmetros do argon2: o que se limita é a quantidade de hashes em paralelo.
func AutoConcurrency(memLimit uint64, cpus int) int {
	if cpus < 1 {
		cpus = 1
	}
	n := cpus
	if memLimit == 0 {
		n = min(n, 4)
	} else {
		n = min(n, int(float64(memLimit)*hashMemoryShare/float64(argonMemoryBytes)))
	}
	return max(1, min(n, maxHashSlots))
}

// HashLimiter limita os hashes de senha simultâneos. Quem não consegue vaga espera numa fila de
// tamanho limitado, por no máximo `timeout`; passou disso, ErrBusy.
type HashLimiter struct {
	slots    chan struct{}
	waiting  atomic.Int64
	maxQueue int64
	timeout  time.Duration
}

func NewHashLimiter(concurrency, maxQueue int, timeout time.Duration) *HashLimiter {
	return &HashLimiter{
		slots:    make(chan struct{}, max(1, concurrency)),
		maxQueue: int64(max(0, maxQueue)),
		timeout:  timeout,
	}
}

func (l *HashLimiter) Capacity() int { return cap(l.slots) }

// Acquire reserva uma vaga e devolve a função que a libera.
func (l *HashLimiter) Acquire(ctx context.Context) (release func(), err error) {
	rel := func() { <-l.slots }
	select {
	case l.slots <- struct{}{}:
		return rel, nil
	default:
	}
	if l.waiting.Add(1) > l.maxQueue {
		l.waiting.Add(-1)
		return nil, ErrBusy
	}
	defer l.waiting.Add(-1)
	timer := time.NewTimer(l.timeout)
	defer timer.Stop()
	select {
	case l.slots <- struct{}{}:
		return rel, nil
	case <-timer.C:
		return nil, ErrBusy
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// Hash e Verify rodam o argon2id dentro do limite.
func (l *HashLimiter) Hash(ctx context.Context, password string) (string, error) {
	release, err := l.Acquire(ctx)
	if err != nil {
		return "", err
	}
	defer release()
	return HashPassword(password)
}

func (l *HashLimiter) Verify(ctx context.Context, password, encoded string) (bool, error) {
	release, err := l.Acquire(ctx)
	if err != nil {
		return false, err
	}
	defer release()
	return VerifyPassword(password, encoded)
}
