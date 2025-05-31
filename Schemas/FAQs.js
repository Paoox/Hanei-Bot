const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
  pregunta: { type: String, required: true },
  respuesta: { type: String, required: true }
});

module.exports = mongoose.model('Faq', faqSchema);
