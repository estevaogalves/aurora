package domain

import "bytes"

// Comprovantes anexados a um lançamento. Só imagem (PNG, JPEG, WebP) e PDF, de até 300 KiB, no máximo 5 por lançamento.
const (
	MaxReceiptBytes           = 300 * 1024
	MaxReceiptsPerTransaction = 5
	MaxReceiptNameLength      = 80
)

// ReceiptMeta são os dados de um anexo, sem o conteúdo (que sai só por GET /receipts/{id}).
type ReceiptMeta struct {
	ID            string `json:"id"`
	TransactionID string `json:"transactionId"`
	Name          string `json:"name"`
	Mime          string `json:"mime"`
	Size          int    `json:"size"`
	// CreatedAt: "AAAA-MM-DD".
	CreatedAt string `json:"createdAt"`
}

// ReceiptMime devolve o tipo de um arquivo pelos primeiros bytes (nunca pelo nome nem pelo tipo que o cliente disse),
// ou "" se não for um dos aceitos. SVG e HTML ficam de fora de propósito (podem executar código).
func ReceiptMime(data []byte) string {
	switch {
	case bytes.HasPrefix(data, []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}):
		return "image/png"
	case bytes.HasPrefix(data, []byte{0xFF, 0xD8, 0xFF}):
		return "image/jpeg"
	case len(data) >= 12 && bytes.Equal(data[0:4], []byte("RIFF")) && bytes.Equal(data[8:12], []byte("WEBP")):
		return "image/webp"
	case bytes.HasPrefix(data, []byte("%PDF-")):
		return "application/pdf"
	}
	return ""
}
