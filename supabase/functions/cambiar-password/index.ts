// ════════════════════════════════════════════════════════════════
// Lumea Med — cambiar la contraseña de otro usuario
//
// Por qué existe: la contraseña real vive en Supabase Auth y cambiarla para
// OTRA persona exige la clave de servicio. Esa clave no puede viajar al
// navegador —cualquiera la leería con F12 y tendría acceso total a la base—,
// así que vive aquí, en el servidor, y el panel llama a esta función.
//
// Quién puede usarla: sólo el Super Admin. Se comprueba con el token de quien
// llama, que Supabase Auth firma y el navegador no puede falsificar. No basta
// con que el navegador diga que es Super Admin.
//
// Desplegar en: Supabase → Edge Functions → Deploy a new function
// ════════════════════════════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPER_ADMIN_EMAIL = 'sebasgale65@gmail.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  const URL_SB     = Deno.env.get('SUPABASE_URL')!;
  const ANON       = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICIO   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const autorizacion = req.headers.get('Authorization') ?? '';
  if (!autorizacion) return responder({ error: 'Falta la sesión' }, 401);

  // ── 1. ¿Quién llama? Se resuelve con su propio token, no con lo que diga el cuerpo
  const comoUsuario = createClient(URL_SB, ANON, {
    global: { headers: { Authorization: autorizacion } },
  });
  const { data: { user: quienLlama }, error: errUser } = await comoUsuario.auth.getUser();
  if (errUser || !quienLlama) return responder({ error: 'Tu sesión no es válida' }, 401);

  const admin = createClient(URL_SB, SERVICIO, { auth: { persistSession: false } });

  // ── 2. ¿Es Super Admin? Por correo del token o por su rol en profiles
  const correoQuienLlama = (quienLlama.email ?? '').trim().toLowerCase();
  let esSuperAdmin = correoQuienLlama === SUPER_ADMIN_EMAIL;
  if (!esSuperAdmin) {
    const { data: perfil } = await admin
      .from('profiles').select('rol').eq('id', quienLlama.id).maybeSingle();
    esSuperAdmin = perfil?.rol === 'superadmin';
  }
  if (!esSuperAdmin) {
    return responder({ error: 'Solo el Super Admin puede cambiar contraseñas' }, 403);
  }

  // ── 3. Datos de la petición
  let cuerpo: { email?: string; password?: string };
  try { cuerpo = await req.json(); }
  catch { return responder({ error: 'Petición mal formada' }, 400); }

  const correoDestino = (cuerpo.email ?? '').trim().toLowerCase();
  const claveNueva    = cuerpo.password ?? '';
  if (!correoDestino) return responder({ error: 'Falta el correo del usuario' }, 400);
  if (claveNueva.length < 6) {
    return responder({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);
  }

  // ── 4. Localizar la cuenta. El id de profiles puede no coincidir con el de
  // Auth, así que se busca por correo, que es lo que el usuario escribe al entrar.
  let destino: { id: string; email?: string } | undefined;
  for (let pagina = 1; pagina <= 20 && !destino; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) return responder({ error: 'No se pudo consultar los usuarios: ' + error.message }, 500);
    if (!data.users.length) break;
    destino = data.users.find(u => (u.email ?? '').trim().toLowerCase() === correoDestino);
    if (data.users.length < 200) break;
  }
  let cuentaCreada = false;
  if (!destino) {
    const { data: creado, error: errCrear } = await admin.auth.admin.createUser({
      email: correoDestino,
      password: claveNueva,
      email_confirm: true,
    });
    if (errCrear) {
      return responder({ error: `No existe una cuenta de acceso para ${correoDestino} y no se pudo crear: ${errCrear.message}` }, 500);
    }
    if (!creado.user) {
      return responder({ error: `No se pudo crear la cuenta de acceso para ${correoDestino}` }, 500);
    }
    cuentaCreada = true;
    destino = { id: creado.user.id, email: creado.user.email ?? correoDestino };
  }

  // ── 5. Cambiar la contraseña y dejar el correo confirmado, para que pueda
  // entrar de inmediato sin depender del envío de correos.
  const { error: errCambio } = await admin.auth.admin.updateUserById(destino.id, {
    password: claveNueva,
    email_confirm: true,
  });
  if (errCambio) return responder({ error: 'No se pudo cambiar: ' + errCambio.message }, 500);

  // ── 6. Desbloquear el perfil y retirar cualquier clave antigua en texto plano
  await admin.from('profiles')
    .update({ bloqueado: false, intentos_fallidos: 0, password: null })
    .ilike('email', correoDestino);

  return responder({ ok: true, email: correoDestino, cuentaCreada });
});
