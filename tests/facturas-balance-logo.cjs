const fs = require('fs');
const path = require('path');
const assert = require('assert').strict;

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'migracion_borrado_facturas.sql'), 'utf8');

assert.match(app, /function puedeVerBalance\(\)[\s\S]*medico_admin/);
assert.match(app, /if\(tab === 'balance' && !puedeVerBalance\(\)\)/);
assert.match(app, /sb\.rpc\('cambiar_modo_balance_clinica'/);
assert.match(app, /sb\.rpc\('eliminar_factura_completa',\{p_factura_id:id\}\)/);
assert.match(app, /factura_id:id/);
assert.match(app, /cfg = \{\.\.\.getClinicaConfig\(\), \.\.\.cfg\}/);
assert.match(app, /logoUrl:d\.logoUrl\|\|cfg\.logoUrl/);
assert.match(app, /tipo_documento_factura === 'comprobante_pago'[\s\S]*'COMPROBANTE DE PAGO' : 'FACTURA'/);
assert.match(app, /tipoDocumento === 'COMPROBANTE DE PAGO' \? 'Recibido de:' : 'Facturar a:'/);
assert.match(app, /const numeroImpreso = fact\.numero \? String\(fact\.numero\)\.replace\(\/\^FACT-\/i,''\)/);
assert.match(app, /pdfAbrir\(`\$\{tipoDocumento\} \$\{numeroImpreso\}/);
assert.match(html, /id="fact-numero"[^>]+readonly/);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.reservar_numero_factura/);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.eliminar_factura_completa/);
assert.match(migration, /SET stock_actual = COALESCE\(stock_actual, 0\) \+ r\.cantidad/);

const balanceMigration = fs.readFileSync(path.join(root, 'migracion_balance_manual.sql'), 'utf8');
assert.match(balanceMigration, /CREATE OR REPLACE FUNCTION public\.cambiar_modo_balance_clinica/);

const tipoDocumentoMigration = fs.readFileSync(path.join(root, 'migracion_tipo_documento_factura.sql'), 'utf8');
assert.match(tipoDocumentoMigration, /ADD COLUMN IF NOT EXISTS tipo_documento_factura/);
assert.match(html, /id="config-tipo-doc-factura"[\s\S]*value="comprobante_pago"/);

console.log('OK: borrado integral, consecutivo, acceso al balance y logo documental.');
