-- +goose Up
-- Negócio próprio (revenda etc.): nova família "business" e novo tipo de movimentação "income" (recebimento).
-- Só afrouxa duas regras CHECK; nenhuma linha existente muda.
ALTER TABLE investments DROP CONSTRAINT investments_family_check;
ALTER TABLE investments ADD CONSTRAINT investments_family_check
    CHECK (family IN ('fixed', 'treasury', 'liquid', 'equity', 'fund', 'other', 'business'));

ALTER TABLE investment_movements DROP CONSTRAINT investment_movements_type_check;
ALTER TABLE investment_movements ADD CONSTRAINT investment_movements_type_check
    CHECK (type IN ('contribution', 'redemption', 'yield', 'adjustment', 'income'));

-- +goose Down
DELETE FROM investment_movements WHERE type = 'income' OR investment_id IN (SELECT id FROM investments WHERE family = 'business');
DELETE FROM investments WHERE family = 'business';
ALTER TABLE investment_movements DROP CONSTRAINT investment_movements_type_check;
ALTER TABLE investment_movements ADD CONSTRAINT investment_movements_type_check
    CHECK (type IN ('contribution', 'redemption', 'yield', 'adjustment'));
ALTER TABLE investments DROP CONSTRAINT investments_family_check;
ALTER TABLE investments ADD CONSTRAINT investments_family_check
    CHECK (family IN ('fixed', 'treasury', 'liquid', 'equity', 'fund', 'other'));
