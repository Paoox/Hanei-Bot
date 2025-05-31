// config/db.js
const mongoose = require('mongoose');
require('dotenv').config();

const mongoURI = process.env.MONGO_URI;

const connectDB = async () => {
  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("✅ Conectado a MongoDB Atlas con éxito");
    console.log(`🔗 Base de datos: ${mongoose.connection.name}`);
  } catch (err) {
    console.error("❌ Error al conectar a MongoDB", err);
    process.exit(1);
  }
};

module.exports = connectDB;
