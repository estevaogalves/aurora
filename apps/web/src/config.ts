/**
 * Escolhe de onde vêm os dados:
 *  - `local` (padrão): localStorage, sem login.
 *  - `api`: backend Go, com login. Veja `.env.example`.
 */
export type DataSource = "local" | "api";

export const DATA_SOURCE: DataSource = import.meta.env.VITE_DATA_SOURCE === "api" ? "api" : "local";

/** Base da API. Por padrão o mesmo endereço do front (proxy do Vite em dev, nginx em produção). */
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api/v1";
