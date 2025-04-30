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
app.use(cors());
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
