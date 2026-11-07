package auth

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

func newRedis(t *testing.T) (*redis.Client, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { rdb.Close() })
	return rdb, mr
}

func TestPasswordHash(t *testing.T) {
	hash, err := HashPassword("correct horse")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(hash, "$argon2id$v=19$") {
		t.Fatalf("formato inesperado: %s", hash)
	}
	if ok, err := VerifyPassword("correct horse", hash); err != nil || !ok {
		t.Errorf("senha certa deveria passar: ok=%v err=%v", ok, err)
	}
	if ok, _ := VerifyPassword("wrong", hash); ok {
		t.Error("senha errada passou")
	}
	other, _ := HashPassword("correct horse")
	if other == hash {
		t.Error("o salt deveria tornar os hashes diferentes")
	}
	if _, err := VerifyPassword("x", "lixo"); err != ErrInvalidHash {
		t.Errorf("hash malformado: err=%v", err)
	}
}

func TestJWT(t *testing.T) {
	secret := strings.Repeat("s", 32)
	j := NewJWT(secret, time.Minute)
	id := uuid.New()

	tok, _, err := j.Issue(id, "admin")
	if err != nil {
		t.Fatal(err)
	}
	claims, err := j.Parse(tok)
	if err != nil {
		t.Fatal(err)
	}
	if got, _ := claims.UserID(); got != id || claims.Role != "admin" {
		t.Errorf("claims: %+v", claims)
	}

	// assinatura de outro segredo
	if _, err := NewJWT(strings.Repeat("x", 32), time.Minute).Parse(tok); err == nil {
		t.Error("token com outro segredo foi aceito")
	}
	// expirado
	j.now = func() time.Time { return time.Now().Add(2 * time.Minute) }
	if _, err := j.Parse(tok); err == nil {
		t.Error("token expirado foi aceito")
	}
	// alg=none
	none, _ := jwt.NewWithClaims(jwt.SigningMethodNone, Claims{Role: "admin", RegisteredClaims: jwt.RegisteredClaims{Subject: id.String(), Issuer: issuer, ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}}).SignedString(jwt.UnsafeAllowNoneSignatureType)
	if _, err := NewJWT(secret, time.Minute).Parse(none); err == nil {
		t.Error("token alg=none foi aceito")
	}
}

func TestRefreshRotation(t *testing.T) {
	rdb, mr := newRedis(t)
	r := NewRefresh(rdb, time.Hour)
	ctx := context.Background()
	user := uuid.New()

	token, hash, _, err := r.Issue(ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	// o Redis guarda só o hash
	if mr.Exists("refresh:" + token) {
		t.Error("o token em si não pode estar no Redis")
	}
	if !mr.Exists("refresh:" + hash) {
		t.Error("o hash deveria estar no Redis")
	}

	got, h, err := r.Consume(ctx, token)
	if err != nil || got != user || h != hash {
		t.Fatalf("consume: %v %v %v", got, h, err)
	}
	if _, _, err := r.Consume(ctx, token); err != ErrRefreshInvalid {
		t.Errorf("token só vale uma vez, err=%v", err)
	}
	if _, _, err := r.Consume(ctx, "inventado"); err != ErrRefreshInvalid {
		t.Errorf("token desconhecido, err=%v", err)
	}

	// expiração
	token2, _, _, _ := r.Issue(ctx, user)
	mr.FastForward(2 * time.Hour)
	if _, _, err := r.Consume(ctx, token2); err != ErrRefreshInvalid {
		t.Errorf("token expirado, err=%v", err)
	}
}

func TestRefreshRevokeAll(t *testing.T) {
	rdb, _ := newRedis(t)
	r := NewRefresh(rdb, time.Hour)
	ctx := context.Background()
	user, other := uuid.New(), uuid.New()

	a, _, _, _ := r.Issue(ctx, user)
	b, _, _, _ := r.Issue(ctx, user)
	c, _, _, _ := r.Issue(ctx, other)

	if err := r.RevokeAll(ctx, user); err != nil {
		t.Fatal(err)
	}
	for _, tok := range []string{a, b} {
		if _, _, err := r.Consume(ctx, tok); err != ErrRefreshInvalid {
			t.Error("token do usuário deveria ter sido revogado")
		}
	}
	if _, _, err := r.Consume(ctx, c); err != nil {
		t.Error("token de outro usuário não pode ser afetado")
	}
}

func TestLoginLimiter(t *testing.T) {
	rdb, mr := newRedis(t)
	l := NewLoginLimiter(rdb, 3, time.Minute)
	ctx := context.Background()

	for i := 0; i < 2; i++ {
		_ = l.Fail(ctx, "a@x.com|1.1.1.1")
	}
	if blocked, _, _ := l.Blocked(ctx, "a@x.com|1.1.1.1"); blocked {
		t.Error("não deveria bloquear com 2 falhas")
	}
	_ = l.Fail(ctx, "a@x.com|1.1.1.1")
	blocked, wait, _ := l.Blocked(ctx, "a@x.com|1.1.1.1")
	if !blocked || wait <= 0 || wait > time.Minute {
		t.Errorf("blocked=%v wait=%v", blocked, wait)
	}
	if blocked, _, _ := l.Blocked(ctx, "b@x.com|1.1.1.1"); blocked {
		t.Error("outra chave não pode ser afetada")
	}

	// a janela expira
	mr.FastForward(2 * time.Minute)
	if blocked, _, _ := l.Blocked(ctx, "a@x.com|1.1.1.1"); blocked {
		t.Error("deveria liberar depois da janela")
	}

	// sucesso zera
	for i := 0; i < 3; i++ {
		_ = l.Fail(ctx, "c")
	}
	_ = l.Reset(ctx, "c")
	if blocked, _, _ := l.Blocked(ctx, "c"); blocked {
		t.Error("reset deveria liberar")
	}
}
