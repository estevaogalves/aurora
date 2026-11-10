// Package sqlitetypes tem os tipos Go das colunas que o SQLite não tem de fábrica (JSON e lista de textos).
// O sqlc os usa pelos overrides do sqlc.yaml. Os dois guardam TEXT, para as funções json_* do SQLite funcionarem.
package sqlitetypes

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

// JSON é um documento JSON guardado como TEXT. Nil vira NULL. É um []byte: serve direto em json.Unmarshal e len().
type JSON []byte

func (j *JSON) Scan(src any) error {
	switch v := src.(type) {
	case nil:
		*j = nil
	case string:
		*j = JSON(v)
	case []byte:
		*j = append(JSON(nil), v...)
	default:
		return fmt.Errorf("sqlitetypes.JSON: tipo %T não suportado", src)
	}
	return nil
}

func (j JSON) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return string(j), nil
}

// TextList é uma lista de textos guardada como um array JSON em TEXT. Nil vira "[]".
type TextList []string

func (l *TextList) Scan(src any) error {
	var raw []byte
	switch v := src.(type) {
	case nil:
		*l = nil
		return nil
	case string:
		raw = []byte(v)
	case []byte:
		raw = v
	default:
		return fmt.Errorf("sqlitetypes.TextList: tipo %T não suportado", src)
	}
	var out []string
	if err := json.Unmarshal(raw, &out); err != nil {
		return err
	}
	*l = out
	return nil
}

func (l TextList) Value() (driver.Value, error) {
	if l == nil {
		return "[]", nil
	}
	raw, err := json.Marshal([]string(l))
	if err != nil {
		return nil, err
	}
	return string(raw), nil
}
