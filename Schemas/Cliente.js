const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  telefono: { type: String, required: true },
  correo: String,
  direccion: String,
  intereses: [String], // Array de productos o categorías de interés
  creadoEn: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Cliente', clienteSchema);
