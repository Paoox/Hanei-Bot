const mongoose = require('mongoose');

const horariosSchema = new mongoose.Schema({
  lunes_a_viernes: { type: String, required: true },
  sabado: { type: String, required: true },
  domingo: { type: String, required: true }
});

const redesSocialesSchema = new mongoose.Schema({
  facebook: { type: String }
});

const contactoSchema = new mongoose.Schema({
  telefono: { type: String, required: true }
});

const empresaSchema = new mongoose.Schema({
  nombre_empresa: { type: String, required: true },
  descripcion: { type: String, required: true },
  horarios: { type: horariosSchema, required: true },
  metodos_pago: [{ type: String, required: true }],
  tiempo_envio: { type: String, required: true },
  zonas_cobertura: { type: String, required: true },
  redes_sociales: redesSocialesSchema,
  contacto: { type: contactoSchema, required: true }
});

module.exports = mongoose.model('Empresa', empresaSchema);
