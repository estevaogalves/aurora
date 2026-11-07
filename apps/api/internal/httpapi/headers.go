package httpapi

import "net/http"

// apiHeaders: respostas da API são JSON de dados pessoais; nada de sniffing de tipo nem de cache
// em navegador ou proxy.
func apiHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}
