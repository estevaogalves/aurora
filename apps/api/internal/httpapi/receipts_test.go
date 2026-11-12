package httpapi_test

import (
	"bytes"
	"encoding/base64"
	"net/http"
	"testing"

	"aurora/api/internal/domain"
)

var pngBytes = append([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}, bytes.Repeat([]byte{0}, 64)...)

func b64(b []byte) string { return base64.StdEncoding.EncodeToString(b) }

// Comprovantes: só PNG, JPEG, WebP e PDF (pelos bytes), até 300 KiB e 5 por lançamento; só o dono lê e apaga.
func TestReceipts(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	r := e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Mercado", "amount": 8000, "type": "expense", "category": "Alimentação", "month": "2026-11"})
	want(t, r, http.StatusCreated)
	var tx domain.Transaction
	r.json(t, &tx)
	url := "/api/v1/transactions/" + tx.ID + "/receipts"

	// anexar um PNG (o nome com caminho vira só o nome do arquivo)
	r = e.do(t, "POST", url, tk, map[string]any{"name": "../../etc/nota fiscal.png", "mime": "image/png", "data": b64(pngBytes)})
	want(t, r, http.StatusCreated)
	var meta domain.ReceiptMeta
	r.json(t, &meta)
	if meta.Name != "nota fiscal.png" || meta.Mime != "image/png" || meta.Size != len(pngBytes) || meta.TransactionID != tx.ID {
		t.Fatalf("anexo: %+v", meta)
	}

	// vem na lista de dados (sem o conteúdo) e o conteúdo sai por GET /receipts/{id}
	r = e.do(t, "GET", "/api/v1/data", tk, nil)
	var d domain.FinanceData
	r.json(t, &d)
	if len(d.Receipts) != 1 || d.Receipts[0].ID != meta.ID {
		t.Fatalf("lista: %+v", d.Receipts)
	}
	r = e.do(t, "GET", "/api/v1/receipts/"+meta.ID, tk, nil)
	want(t, r, http.StatusOK)
	var content struct {
		Data string `json:"data"`
		Mime string `json:"mime"`
	}
	r.json(t, &content)
	got, _ := base64.StdEncoding.DecodeString(content.Data)
	if !bytes.Equal(got, pngBytes) || content.Mime != "image/png" {
		t.Fatalf("conteúdo diferente do enviado")
	}

	// recusados: tipo que o cliente diz é ignorado (SVG com mime de imagem), arquivo grande, base64 ruim, vazio
	svg := []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)
	want(t, e.do(t, "POST", url, tk, map[string]any{"name": "x.png", "mime": "image/png", "data": b64(svg)}), http.StatusUnsupportedMediaType)
	big := append([]byte("%PDF-1.4\n"), bytes.Repeat([]byte{'a'}, domain.MaxReceiptBytes)...)
	want(t, e.do(t, "POST", url, tk, map[string]any{"name": "grande.pdf", "data": b64(big)}), http.StatusRequestEntityTooLarge)
	want(t, e.do(t, "POST", url, tk, map[string]any{"name": "x", "data": "!!!não é base64"}), http.StatusBadRequest)
	want(t, e.do(t, "POST", url, tk, map[string]any{"name": "x", "data": ""}), http.StatusBadRequest)
	// PDF e lançamento que não existe
	want(t, e.do(t, "POST", url, tk, map[string]any{"name": "recibo.pdf", "data": b64([]byte("%PDF-1.4 ok"))}), http.StatusCreated)
	want(t, e.do(t, "POST", "/api/v1/transactions/00000000-0000-0000-0000-000000000001/receipts", tk, map[string]any{"name": "x.png", "data": b64(pngBytes)}), http.StatusNotFound)

	// no máximo 5 por lançamento
	for i := 0; i < 3; i++ {
		want(t, e.do(t, "POST", url, tk, map[string]any{"name": "mais.png", "data": b64(pngBytes)}), http.StatusCreated)
	}
	want(t, e.do(t, "POST", url, tk, map[string]any{"name": "sexto.png", "data": b64(pngBytes)}), http.StatusUnprocessableEntity)

	// outra conta não vê, não baixa, não anexa e não apaga
	other := e.register(t, "").AccessToken
	want(t, e.do(t, "GET", "/api/v1/receipts/"+meta.ID, other, nil), http.StatusNotFound)
	want(t, e.do(t, "DELETE", "/api/v1/receipts/"+meta.ID, other, nil), http.StatusNotFound)
	want(t, e.do(t, "POST", url, other, map[string]any{"name": "x.png", "data": b64(pngBytes)}), http.StatusNotFound)

	// apagar o comprovante, e apagar o lançamento leva os que sobraram
	want(t, e.do(t, "DELETE", "/api/v1/receipts/"+meta.ID, tk, nil), http.StatusNoContent)
	want(t, e.do(t, "GET", "/api/v1/receipts/"+meta.ID, tk, nil), http.StatusNotFound)
	want(t, e.do(t, "DELETE", "/api/v1/transactions/"+tx.ID, tk, nil), http.StatusNoContent)
	r = e.do(t, "GET", "/api/v1/data", tk, nil)
	var after domain.FinanceData
	r.json(t, &after)
	if len(after.Receipts) != 0 {
		t.Fatalf("apagar o lançamento deveria levar os comprovantes: %d", len(after.Receipts))
	}
}
