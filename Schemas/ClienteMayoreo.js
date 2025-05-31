const mongoose = require('mongoose');

const clienteMayoreoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  telefono: { type: String, required: true },
  correo: String,
  direccion: String,
  pedidosMinimos: Number,
  categoriasPreferidas: [String],
  creadoEn: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ClienteMayoreo', clienteMayoreoSchema);
