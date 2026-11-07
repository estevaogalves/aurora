package domain

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var monthRe = regexp.MustCompile(`^\d{4}-(0[1-9]|1[0-2])$`)

// IsValidMonth confere o formato "YYYY-MM".
func IsValidMonth(m string) bool { return monthRe.MatchString(m) }

func parseMonth(m string) (year, month int) {
	parts := strings.SplitN(m, "-", 2)
	if len(parts) != 2 {
		return 0, 0
	}
	year, _ = strconv.Atoi(parts[0])
	month, _ = strconv.Atoi(parts[1])
	return year, month
}

// MonthsDifference devolve quantos meses a partir de b até a (negativo se a é anterior).
func MonthsDifference(a, b string) int {
	ya, ma := parseMonth(a)
	yb, mb := parseMonth(b)
	return (ya-yb)*12 + (ma - mb)
}

// CompareMonths devolve <0, 0 ou >0.
func CompareMonths(a, b string) int { return MonthsDifference(a, b) }

// ChangeMonth soma (ou subtrai) meses.
func ChangeMonth(m string, offset int) string {
	y, mo := parseMonth(m)
	idx := y*12 + (mo - 1) + offset
	return fmt.Sprintf("%04d-%02d", idx/12, idx%12+1)
}

// MonthsBetween lista os meses de start a end, inclusive.
func MonthsBetween(start, end string) []string {
	out := []string{}
	for cur := start; CompareMonths(cur, end) <= 0; cur = ChangeMonth(cur, 1) {
		out = append(out, cur)
	}
	return out
}
