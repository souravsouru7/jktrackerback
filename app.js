const express= require("express");
let app=express();
const dotenv=require("dotenv");
dotenv.config();
const connectionDB=require("./config/db")
let route= require("./routes/auth")
const bodyParser = require('body-parser');
const entryRoutes = require('./routes/entries');
const balanceSheetRoutes = require('./routes/balanceSheet');
const analyticsRoutes = require('./routes/analytics');
const projectRoutes = require('./routes/projects');
const interiorBillingRoutes = require('./routes/interiorBilling');
const chatRoutes = require('./routes/chat');
const categoryRoutes = require('./routes/categories');

// Add this line
let cors=require("cors");
connectionDB()
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const defaultAllowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const corsAllowedOrigins = [...new Set([...defaultAllowedOrigins, ...allowedOrigins])];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || corsAllowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use((err,req,res,next)=>{
    console.error(err.stack);
    res.status(500).send("Something broke!");
})

app.use('/auth', route);
app.use('/entries', entryRoutes);
app.use('/balance-sheet', balanceSheetRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/interior', interiorBillingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/categories', categoryRoutes);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
