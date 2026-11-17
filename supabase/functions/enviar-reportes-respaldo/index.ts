import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const TITULOS: Record<string, string> = {
  actividad: 'Actividad de la clínica',
  finanzas: 'Finanzas',
  inventario: 'Inventario',
  contabilidad: 'Contabilidad · documentos registrados',
};
type Envio = {
  usuario_id: string;
  correo: string;
  desde: string | null;
  hasta: string;
  reportes: Record<string, Record<string, number>>;
};
type Lote = {
  establecimiento: string;
  formato: string;
  creado_en: string;
  aceptados: number;
  omitidos: number;
  pendientes: number;
  envios: Envio[];
};

const responder = (datos: unknown, status = 200) => new Response(JSON.stringify(datos), {
  status, headers: { ...CORS, 'Content-Type': 'application/json' },
});
const escapar = (texto: string) => String(texto).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
const fecha = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const citaCorte = new Intl.DateTimeFormat('es-NI', {
  timeZone: 'America/Managua', dateStyle: 'medium', timeStyle: 'short',
});
const numero = new Intl.NumberFormat('es-NI', { maximumFractionDigits: 0 });
const moneda = new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function correo(lote: Lote, envio: Envio, remitente: string, id: string) {
  const establecimiento = lote.establecimiento.replace(/[\r\n]/g, ' ').trim();
  const periodo = envio.desde ? `Del ${fecha(envio.desde)} al ${fecha(envio.hasta)}`
    : `Todo el historial hasta el ${fecha(envio.hasta)}`;
  const reportes = Object.entries(TITULOS).filter(([tipo]) => tipo in envio.reportes)
    .map(([tipo, titulo]) => {
      const filas = Object.entries(envio.reportes[tipo])
        .map(([etiqueta, valor]) => `<tr><th scope="row" style="text-align:left;font-weight:400;padding:7px 0;border-bottom:1px solid #e2e8f0">${escapar(etiqueta)}</th><td style="text-align:right;white-space:nowrap;padding:7px 0;border-bottom:1px solid #e2e8f0">${(etiqueta.includes('(C$)') ? moneda : numero).format(valor)}</td></tr>`).join('');
      return `<h2 style="font-size:18px;margin:24px 0 8px">${titulo}</h2>` +
        (filas ? `<table style="width:100%;border-collapse:collapse">${filas}</table>` : '<p>Este módulo no tiene fuentes habilitadas para el reporte.</p>');
    }).join('');
  return {
    from: remitente, to: [envio.correo],
    subject: `Reportes del respaldo de ${establecimiento} · ${fecha(envio.hasta)}`,
    html: `<div style="font-family:Arial,sans-serif;color:#0f172a;max-width:600px;margin:auto;padding:20px">
      <h1 style="font-size:24px;margin-bottom:8px">Reportes del respaldo</h1>
      <p><strong>${escapar(establecimiento)}</strong><br>${periodo}<br>
      Respaldo ${lote.formato.toUpperCase()} del ${citaCorte.format(new Date(lote.creado_en))}</p>
      ${reportes}
      <p style="margin-top:24px"><a href="https://lumeamed.net/">Abrir LumeaMed</a></p>
      <p style="font-size:12px;color:#64748b">Referencia del respaldo ${id}</p>
    </div>`,
  };
}

async function enviar(apiKey: string, id: string, envio: Envio, mensaje: ReturnType<typeof correo>) {
  for (let intento = 0; intento < 2; intento++) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json',
          'Idempotency-Key': `respaldo/${id}/${envio.usuario_id}`,
        },
        body: JSON.stringify(mensaje), signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        const confirmado = await r.json();
        return typeof confirmado.id === 'string' ? confirmado.id : null;
      }
      if (r.status !== 429 && r.status !== 409 && r.status < 500) return null;
      const segundos = Number(r.headers.get('retry-after')) || 1;
      if (intento === 0) await new Promise(resolve => setTimeout(resolve, Math.min(segundos, 4) * 1000));
    } catch {
      if (intento === 1) return null;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido.' }, 405);
  const token = /^Bearer (\S+)$/i.exec(req.headers.get('authorization') || '')?.[1];
  if (!token) return responder({ error: 'Tu sesión no es válida.' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: sesion } = await admin.auth.getUser(token);
  if (sesion || !user) return responder({ error: 'Tu sesión no es válida.' }, 401);

  const cuerpo = await req.json().catch(() => null);
  const id = cuerpo?.id;
  if (typeof id !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) {
    return responder({ error: 'Indica un respaldo válido.' }, 400);
  }
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const remitente = Deno.env.get('RESPALDOS_CORREO_DESDE');
  let cursor: string | null = null;
  for (;;) {
    const { data, error } = await admin.rpc('lote_reportes_respaldo', {
      p_id: id, p_solicitante: user.id, p_despues: cursor,
    });
    if (error) return responder({ error: 'No se pudo consultar el envío del respaldo.' }, 500);
    const lote = data as Lote | null;
    if (!lote) return responder({ error: 'Este respaldo no está disponible para tu sesión.' }, 404);
    if (!lote.envios.length || !apiKey || !remitente) return responder({
      aceptados: lote.aceptados, omitidos: lote.omitidos, pendientes: lote.pendientes,
      configurado: Boolean(apiKey && remitente),
    });

    // Limita peticiones simultáneas y conserva como pendientes los fallos del proveedor.
    for (let i = 0; i < lote.envios.length; i += 2) {
      await Promise.all(lote.envios.slice(i, i + 2).map(async (envio) => {
        const proveedorId = await enviar(apiKey, id, envio, correo(lote, envio, remitente, id));
        if (proveedorId) await admin.from('respaldos_reportes_envios')
          .update({ estado: 'aceptado', proveedor_id: proveedorId })
          .eq('respaldo_id', id).eq('usuario_id', envio.usuario_id).eq('estado', 'pendiente');
      }));
    }
    cursor = lote.envios.at(-1)!.usuario_id;
  }
});
