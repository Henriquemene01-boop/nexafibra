import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
dotenv.config();
const app = express();
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false }));

const PORT = Number(process.env.PORT || 3000);
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const SITE_URL = process.env.SITE_URL;


app.get('/health', (_req, res) => res.json({ ok: true, service: 'NexaFibra checkout' }));

app.post('/api/checkout', async (_req, res) => {
  if (!MP_ACCESS_TOKEN || !SITE_URL) return res.status(503).json({ error: 'Checkout ainda não configurado. Defina MP_ACCESS_TOKEN e SITE_URL.' });
  // Values are server-controlled; never trust the browser to set invoice price or description.
  const preference = {
    items: [{ id: 'NX-DEMO-PLAN', title: 'NexaFibra — fatura demonstrativa', quantity: 1, currency_id: 'BRL', unit_price: 99.90 }],
    external_reference: `NX-${Date.now()}`,
    back_urls: { success: `${SITE_URL}/pagamento/sucesso`, failure: `${SITE_URL}/pagamento/erro`, pending: `${SITE_URL}/pagamento/pendente` },
    auto_return: 'approved'
  };
  try {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(preference)
    });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: 'Não foi possível criar checkout no provedor.', details: data?.message || 'Erro do provedor' });
    // Use sandbox URL during setup/testing. For production, switch only after account and gateway are validated.
    return res.json({ checkout_url: data.sandbox_init_point || data.init_point, preference_id: data.id });
  } catch (_error) {
    return res.status(502).json({ error: 'Falha ao conectar ao provedor de pagamento.' });
  }
});
app.listen(PORT, () => console.log(`NexaFibra checkout backend listening on port ${PORT}`));
