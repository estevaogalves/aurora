// Package audit grava eventos de segurança (login, bloqueio, reuso de token, ações de admin).
//
// Privacidade: um evento só carrega QUATRO coisas: hora (do logger), tipo, id do usuário (quando se sabe
// quem é) e IP. A assinatura de Log não aceita mais nada, então senha, e-mail, token, cookie ou corpo de
// requisição não têm por onde entrar. Eventos são linhas JSON no stdout com msg="audit".
package audit

import (
	"context"
	"log/slog"

	"github.com/google/uuid"
)

// Event é o tipo do evento. Lista fechada: acrescente aqui, nunca texto livre.
type Event string

const (
	Register            Event = "auth.register"
	RegisterRateLimited Event = "auth.register_rate_limited"
	LoginSuccess        Event = "auth.login_success"
	LoginFailed         Event = "auth.login_failed"
	LoginBlocked        Event = "auth.login_blocked"
	Refresh             Event = "auth.refresh"
	RefreshInvalid      Event = "auth.refresh_invalid"
	RefreshReuse        Event = "auth.refresh_reuse"
	Logout              Event = "auth.logout"
	AdminListUsers      Event = "admin.list_users"
	AdminPromote        Event = "admin.promote"
	AdminDemote         Event = "admin.demote"
)

// Logger escreve os eventos de auditoria.
type Logger struct{ l *slog.Logger }

func New(l *slog.Logger) *Logger { return &Logger{l: l} }

// Log registra o evento. userID uuid.Nil = não se sabe quem (ex.: login com e-mail que não existe).
// ip é o IP do cliente já resolvido pela API (ou "cli" para comandos no servidor).
func (a *Logger) Log(ctx context.Context, ev Event, userID uuid.UUID, ip string) {
	attrs := []slog.Attr{slog.String("event", string(ev))}
	if userID != uuid.Nil {
		attrs = append(attrs, slog.String("user_id", userID.String()))
	}
	attrs = append(attrs, slog.String("ip", ip))
	a.l.LogAttrs(ctx, slog.LevelInfo, "audit", attrs...)
}
