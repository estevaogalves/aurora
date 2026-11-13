import { useState } from "react";

/** Divide uma lista em páginas. Se a lista encolher (ao excluir um item, por exemplo), a página atual passa para a última. */
export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages);
  return {
    page: current,
    pages,
    setPage,
    slice: items.slice((current - 1) * pageSize, current * pageSize),
    total: items.length,
    from: items.length === 0 ? 0 : (current - 1) * pageSize + 1,
    to: Math.min(items.length, current * pageSize),
  };
}
