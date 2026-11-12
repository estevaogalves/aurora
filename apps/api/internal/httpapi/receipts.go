package httpapi

import (
	"encoding/base64"
	"net/http"
	"strings"
	"unicode"

	"github.com/go-chi/chi/v5"

	"aurora/api/internal/domain"
)

// Comprovantes (imagem ou PDF) anexados a um lançamento. O conteúdo vai e volta em JSON com base64; o tipo é conferido
// pelos primeiros bytes (nunca pelo nome nem pelo tipo que o cliente disse). Só anexos: nada aqui muda valores.

// receiptBodyLimit: 300 KiB do arquivo em base64 (~400 KiB) mais o JSON em volta.
const receiptBodyLimit = 512 << 10

type receiptUpload struct {
	Name string `json:"name"`
	// Mime é só informativo: o servidor decide pelos bytes.
	Mime string `json:"mime"`
	// Data: o arquivo em base64.
	Data string `json:"data"`
}

type receiptContent struct {
	domain.ReceiptMeta
	Data string `json:"data"`
}

// cleanReceiptName tira caminho, caracteres de controle e espaços das pontas; no máximo 80 letras.
func cleanReceiptName(name string) string {
	name = strings.ReplaceAll(name, "\\", "/")
	if i := strings.LastIndex(name, "/"); i >= 0 {
		name = name[i+1:]
	}
	name = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, name)
	name = strings.TrimSpace(name)
	if r := []rune(name); len(r) > domain.MaxReceiptNameLength {
		name = string(r[:domain.MaxReceiptNameLength])
	}
	return name
}

func (s *Server) createReceipt(w http.ResponseWriter, r *http.Request) {
	var in receiptUpload
	if !decode(w, r, &in, receiptBodyLimit) {
		return
	}
	name := cleanReceiptName(in.Name)
	if name == "" {
		name = "comprovante"
	}
	data, err := base64.StdEncoding.DecodeString(in.Data)
	switch {
	case err != nil || len(data) == 0:
		writeError(w, http.StatusBadRequest, "Arquivo inválido.")
		return
	case len(data) > domain.MaxReceiptBytes:
		writeError(w, http.StatusRequestEntityTooLarge, "O comprovante passa de 300 KB.")
		return
	}
	mime := domain.ReceiptMime(data)
	if mime == "" {
		writeError(w, http.StatusUnsupportedMediaType, "Só são aceitos comprovantes em imagem (PNG, JPEG ou WebP) ou PDF.")
		return
	}
	meta, err := s.store.CreateReceipt(r.Context(), userID(r), chi.URLParam(r, "id"), name, mime, data)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusCreated, meta)
}

func (s *Server) getReceipt(w http.ResponseWriter, r *http.Request) {
	meta, data, err := s.store.GetReceipt(r.Context(), userID(r), chi.URLParam(r, "id"))
	if err != nil {
		s.fail(w, r, err)
		return
	}
	// nunca é servido direto ao navegador (sempre JSON): o front baixa o arquivo, não o abre dentro do app
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, receiptContent{ReceiptMeta: meta, Data: base64.StdEncoding.EncodeToString(data)})
}

func (s *Server) deleteReceipt(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteReceipt(r.Context(), userID(r), chi.URLParam(r, "id")); err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	w.WriteHeader(http.StatusNoContent)
}
