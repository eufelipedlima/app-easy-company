-- ============================================================
-- Easy Company — Sistema Interno
-- Migration 0017: dados de pagamento nos contratos
-- ============================================================

-- Recorrente: data em que a entrada foi/será paga
alter table contratos add column if not exists data_pagamento_entrada date;

-- Pontual: à vista ou parcelado
alter table contratos add column if not exists tipo_pagamento text check (tipo_pagamento in ('avista', 'parcelado'));
alter table contratos add column if not exists data_pagamento date;
alter table contratos add column if not exists situacao_pagamento text check (situacao_pagamento in ('pago', 'pendente'));
alter table contratos add column if not exists quantidade_parcelas integer;
alter table contratos add column if not exists data_primeira_parcela date;
