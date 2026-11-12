import { describe, expect, it } from "vitest";
import { cleanFileName, formatFileSize, receiptMimeOf } from "./index";

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("comprovantes", () => {
  it("o tipo vem dos primeiros bytes", () => {
    expect(receiptMimeOf(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(receiptMimeOf(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(receiptMimeOf(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
    expect(receiptMimeOf(new TextEncoder().encode("%PDF-1.7 ..."))).toBe("application/pdf");
  });
  it("SVG, HTML e qualquer outro arquivo são recusados, mesmo com nome de imagem", () => {
    expect(receiptMimeOf(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'))).toBeNull();
    expect(receiptMimeOf(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(receiptMimeOf(new Uint8Array([]))).toBeNull();
  });
  it("tamanho e nome do arquivo", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(182 * 1024)).toBe("182 KB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1,5 MB");
    expect(cleanFileName("C:\\Users\\eu\\nota fiscal.pdf")).toBe("nota fiscal.pdf");
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName("   ")).toBe("comprovante");
  });
});
