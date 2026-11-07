// Package sysmem descobre quanta memória o processo pode usar (limite do container ou da máquina).
package sysmem

import (
	"os"
	"strconv"
	"strings"
)

// Limit devolve o menor limite de memória conhecido, em bytes, ou 0 se não der para descobrir
// (ex.: fora do Linux). Considera cgroup v2, cgroup v1 e o total da máquina.
func Limit() uint64 {
	var best uint64
	consider := func(v uint64, ok bool) {
		if ok && v > 0 && (best == 0 || v < best) {
			best = v
		}
	}
	for _, p := range []string{"/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"} {
		if raw, err := os.ReadFile(p); err == nil {
			consider(ParseCgroup(string(raw)))
		}
	}
	if raw, err := os.ReadFile("/proc/meminfo"); err == nil {
		consider(ParseMemTotal(string(raw)))
	}
	return best
}

// ParseCgroup lê memory.max / memory.limit_in_bytes. "max" ou valores gigantes significam "sem limite".
func ParseCgroup(s string) (uint64, bool) {
	s = strings.TrimSpace(s)
	if s == "" || s == "max" {
		return 0, false
	}
	v, err := strconv.ParseUint(s, 10, 64)
	if err != nil || v >= 1<<60 {
		return 0, false
	}
	return v, true
}

// ParseMemTotal extrai "MemTotal: N kB" de /proc/meminfo.
func ParseMemTotal(s string) (uint64, bool) {
	for _, line := range strings.Split(s, "\n") {
		if rest, ok := strings.CutPrefix(line, "MemTotal:"); ok {
			f := strings.Fields(rest)
			if len(f) == 0 {
				return 0, false
			}
			kb, err := strconv.ParseUint(f[0], 10, 64)
			return kb * 1024, err == nil
		}
	}
	return 0, false
}
