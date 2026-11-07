package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const issuer = "aurora-api"

var ErrInvalidToken = errors.New("token inválido ou expirado")

type Claims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
}

// UserID devolve o id do usuário (campo "sub").
func (c Claims) UserID() (uuid.UUID, error) { return uuid.Parse(c.Subject) }

// JWT assina e valida os tokens de acesso (HS256).
type JWT struct {
	secret []byte
	ttl    time.Duration
	now    func() time.Time
}

func NewJWT(secret string, ttl time.Duration) *JWT {
	return &JWT{secret: []byte(secret), ttl: ttl, now: time.Now}
}

func (j *JWT) Issue(userID uuid.UUID, role string) (string, time.Time, error) {
	now := j.now()
	exp := now.Add(j.ttl)
	claims := Claims{
		Role: role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			Issuer:    issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(j.secret)
	return signed, exp, err
}

func (j *JWT) Parse(token string) (*Claims, error) {
	claims := &Claims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("método de assinatura inesperado: %v", t.Header["alg"])
		}
		return j.secret, nil
	}, jwt.WithIssuer(issuer), jwt.WithExpirationRequired(), jwt.WithTimeFunc(j.now))
	if err != nil || !parsed.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}
