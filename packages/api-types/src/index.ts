// Tipos gerados de docs/openapi.yaml (`pnpm --filter @aurora/api-types generate`).
// Não edite schema.d.ts à mão.
import type { components, paths } from "./schema";

export type { components, paths };

type Schemas = components["schemas"];

export type ApiError = Schemas["Error"];
export type ApiUser = Schemas["User"];
export type ApiSession = Schemas["Session"];
export type ApiRegisterRequest = Schemas["RegisterRequest"];
export type ApiLoginRequest = Schemas["LoginRequest"];
export type ApiFinanceData = Schemas["FinanceData"];
export type ApiTransaction = Schemas["Transaction"];
export type ApiTransactionPatch = Schemas["TransactionPatch"];
export type ApiCredit = Schemas["CreditTransaction"];
export type ApiCreditPatch = Schemas["CreditPatch"];
export type ApiGoal = Schemas["Goal"];
export type ApiGoalPatch = Schemas["GoalPatch"];
export type ApiExtraExpense = Schemas["ExtraExpense"];
export type ApiExtraExpensePatch = Schemas["ExtraExpensePatch"];
export type ApiNote = Schemas["Note"];
export type ApiNotePatch = Schemas["NotePatch"];
export type ApiCustomCategory = Schemas["CustomCategory"];
export type ApiDistributionItem = Schemas["DistributionItem"];
export type ApiMonthSummary = Schemas["MonthSummary"];
export type ApiProjectionMonth = Schemas["ProjectionMonth"];
export type ApiComparison = Schemas["Comparison"];
