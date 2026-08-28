const http = require('http');
const data = JSON.stringify({
  cedula: "123456",
  nombreFuncionario: "Prueba Sistema",
  tipo: "MEDICO",
  fechaInicio: "19/08/2026"
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/permisos',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', console.error);
req.write(data);
req.end();
