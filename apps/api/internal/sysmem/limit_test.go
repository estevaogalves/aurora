package sysmem

import "testing"

func TestParseCgroup(t *testing.T) {
	cases := []struct {
		in   string
		want uint64
		ok   bool
	}{
		{"536870912\n", 512 << 20, true},
		{"max\n", 0, false},
		{"", 0, false},
		{"9223372036854771712\n", 0, false}, // "sem limite" do cgroup v1
		{"lixo", 0, false},
	}
	for _, c := range cases {
		if got, ok := ParseCgroup(c.in); got != c.want || ok != c.ok {
			t.Errorf("ParseCgroup(%q) = %d, %v", c.in, got, ok)
		}
	}
}

func TestParseMemTotal(t *testing.T) {
	got, ok := ParseMemTotal("MemFree: 1 kB\nMemTotal:       2048 kB\nBuffers: 3 kB\n")
	if !ok || got != 2048*1024 {
		t.Fatalf("got %d, %v", got, ok)
	}
	if _, ok := ParseMemTotal("nada"); ok {
		t.Fatal("deveria falhar sem MemTotal")
	}
}
