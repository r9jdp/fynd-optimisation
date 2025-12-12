const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require("path");
const sqlite3 = require('sqlite3').verbose();
const serveStatic = require("serve-static");
const { readFileSync } = require('fs');
const { setupFdk } = require("@gofynd/fdk-extension-javascript/express");
const { SQLiteStorage } = require("@gofynd/fdk-extension-javascript/express/storage");
const sqliteInstance = new sqlite3.Database('session_storage.db');
const productRouter = express.Router();
const axios = require('axios');
// import { createClient } from "@boltic/sdk";
const {createClient} = require("@boltic/sdk");
const dotenv = require('dotenv');
dotenv.config();

    const client = createClient(process.env.BOLTIC_API_KEY);

    async function tablefetcher() {
      // 1. Get the table metadata to find the correct table name
      const { data: usersTable, error } = await client.tables.findById("98898da1-bb1d-4c0d-a60d-06d14c6caaa4");
    
      if (error) {
        console.error("Error In table :", error.message || error.meta);
      } else {
        console.log(`Found table: ${usersTable.name} (${usersTable.id})`);
        
        try {
            // 2. Use executeSQL to fetch records. 
            // We use double quotes around the table name to handle any special characters or case sensitivity.
            const query = `SELECT * FROM "${usersTable.name}" LIMIT 10`;
            const result = await client.sql.executeSQL(query);

            // 3. The SDK returns data as an array: [rows, metadata]
            if (result && result.data) {
                const [rows] = result.data;
                console.log("Table Data:", JSON.stringify(rows, null, 2));
            }
        } catch (sqlError) {
            console.error("Error executing SQL:", sqlError);
        }
      } 
    }
    tablefetcher();


const fdkExtension = setupFdk({
    api_key: process.env.EXTENSION_API_KEY,
    api_secret: process.env.EXTENSION_API_SECRET,
    base_url: process.env.EXTENSION_BASE_URL,
    cluster: process.env.FP_API_DOMAIN || "api.fynd.com",
    callbacks: {
        auth: async (req) => {
            // Write you code here to return initial launch url after auth process complete
            if (req.query.application_id)
                return `${req.extension.base_url}/company/${req.query['company_id']}/application/${req.query.application_id}`;
            else
                return `${req.extension.base_url}/company/${req.query['company_id']}`;
        },
        
        uninstall: async (req) => {
            // Write your code here to cleanup data related to extension
            // If task is time taking then process it async on other process.
        }
    },
    storage: new SQLiteStorage(sqliteInstance,"exapmple-fynd-platform-extension"), // add your prefix
    access_mode: "online",
    webhook_config: {
        api_path: "/api/webhook-events",
        notification_email: "useremail@example.com",
        event_map: {
            "company/product/delete": {
                "handler": (eventName) => {  console.log(eventName)},
                "version": '1'
            }
        }
    },
});

const STATIC_PATH = process.env.NODE_ENV === 'production'
    ? path.join(process.cwd(), 'frontend', 'public' , 'dist')
    : path.join(process.cwd(), 'frontend');
    
const app = express();
const platformApiRoutes = fdkExtension.platformApiRoutes;

// Middleware to parse cookies with a secret key
app.use(cookieParser("ext.session"));

// Middleware to parse JSON bodies with a size limit of 2mb
app.use(bodyParser.json({
    limit: '2mb'
}));

// Serve static files from the React dist directory
app.use(serveStatic(STATIC_PATH, { index: false }));

// FDK extension handler and API routes (extension launch routes)
app.use("/", fdkExtension.fdkHandler);

// Route to handle webhook events and process it.
app.post('/api/webhook-events', async function(req, res) {
    try {
      console.log(`Webhook Event: ${req.body.event} received`)
      await fdkExtension.webhookRegistry.processWebhook(req);
      return res.status(200).json({"success": true});
    } catch(err) {
      console.log(`Error Processing ${req.body.event} Webhook`);
      return res.status(500).json({"success": false});
    }
})

productRouter.get('/', async function view(req, res, next) {
    try {
        const {
            platformClient
        } = req;
        
        // Fetch all products by paginating through all pages
        let allProducts = [];
        let pageNo = 1;
        let hasNext = true;
        
        while (hasNext) {
            const data = await platformClient.catalog.getProducts({
                page_no: pageNo,
                page_size: 100
            });
            allProducts = [...allProducts, ...(data.items || [])];
            hasNext = data.page?.has_next || false;
            pageNo++;
        }
        
        return res.json({ items: allProducts });
    } catch (err) {
        next(err);
    }
});

// Get products list for application
productRouter.get('/application/:application_id', async function view(req, res, next) {
    try {
        const {
            platformClient
        } = req;
        const { application_id } = req.params;
        
        // Fetch all application products by paginating through all pages
        let allProducts = [];
        let pageNo = 1;
        let hasNext = true;
        
        while (hasNext) {
            const data = await platformClient.application(application_id).catalog.getAppProducts({
                page_no: pageNo,
                page_size: 100
            });
            allProducts = [...allProducts, ...(data.items || [])];
            hasNext = data.page?.has_next || false;
            pageNo++;
        }
        
        return res.json({ items: allProducts });
    } catch (err) {
        next(err);
    }
});

productRouter.get('/pricing-status', async (req, res) => {
    try {
        const { data: usersTable, error } = await client.tables.findById("98898da1-bb1d-4c0d-a60d-06d14c6caaa4");
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        
        const query = `SELECT * FROM "${usersTable.name}"`; 
        const result = await client.sql.executeSQL(query);
        
        if (result && result.data) {
            const [rows] = result.data;
            // Return the last row as "latest"
            return res.json({ latest: rows[rows.length - 1], all: rows });
        }
        return res.json({ latest: null, all: [] });

    } catch (err) {
        console.error("Error fetching pricing status:", err);
        res.status(500).json({ error: err.message });
    }
});

productRouter.post('/accept-price-update', async (req, res) => {
    try {
        const API_URL = "https://asia-south1.api.boltic.io/service/webhook/temporal/v1.0/6a74814f-4a31-4a20-b9d2-79d0df5b924e/workflows/execute/ebfad512-2b1e-41be-9284-f77c7a58c267";
        const response = await axios.post(API_URL, {}, {
            headers: {
                "Content-Type": "application/json"
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error("Error triggering workflow:", error);
        res.status(500).json({ error: "Failed to trigger workflow" });
    }
});

productRouter.post('/deny-price-update', async (req, res) => {
    try {
        const { data: usersTable, error } = await client.tables.findById("98898da1-bb1d-4c0d-a60d-06d14c6caaa4");
        if (error) {
            return res.status(500).json({ error: error.message });
        }

        // Assuming we want to delete the pending record. 
        // If an ID is provided in req.body, we could use that, but 'status = PENDING' is safer if ID is unknown.
        // However, to be more precise, if we have an ID, we should use it.
        // Let's try to use ID if available, otherwise fallback to status='PENDING'.
        
        let query;
        if (req.body.id) {
             query = `DELETE FROM "${usersTable.name}" WHERE id = '${req.body.id}'`;
        } else {
             query = `DELETE FROM "${usersTable.name}" WHERE status = 'PENDING'`;
        }

        console.log("Executing delete query:", query);
        const result = await client.sql.executeSQL(query);
        
        res.json({ success: true, result });

    } catch (err) {
        console.error("Error denying price update:", err);
        res.status(500).json({ error: err.message });
    }
});

productRouter.post('/edit-price-update', async (req, res) => {
    try {
        const { new_price, id } = req.body;
        if (!new_price) {
            return res.status(400).json({ error: "New price is required" });
        }

        const { data: usersTable, error } = await client.tables.findById("98898da1-bb1d-4c0d-a60d-06d14c6caaa4");
        if (error) {
            return res.status(500).json({ error: error.message });
        }

        let updateQuery;
        if (id) {
             updateQuery = `UPDATE "${usersTable.name}" SET suggested_price = '${new_price}' WHERE id = '${id}'`;
        } else {
             updateQuery = `UPDATE "${usersTable.name}" SET suggested_price = '${new_price}' WHERE status = 'PENDING'`;
        }
        
        console.log("Executing update query:", updateQuery);
        await client.sql.executeSQL(updateQuery);

        // Trigger workflow
        const API_URL = "https://asia-south1.api.boltic.io/service/webhook/temporal/v1.0/6a74814f-4a31-4a20-b9d2-79d0df5b924e/workflows/execute/ebfad512-2b1e-41be-9284-f77c7a58c267";
        const response = await axios.post(API_URL, {}, {
            headers: {
                "Content-Type": "application/json"
            }
        });

        res.json({ success: true, workflow_response: response.data });

    } catch (err) {
        console.error("Error editing price update:", err);
        res.status(500).json({ error: err.message });
    }
});

// FDK extension api route which has auth middleware and FDK client instance attached to it.
platformApiRoutes.use('/products', productRouter);

// If you are adding routes outside of the /api path, 
// remember to also add a proxy rule for them in /frontend/vite.config.js
app.use('/api', platformApiRoutes);

// Serve the React app for all other routes
app.get('*', (req, res) => {
    return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(readFileSync(path.join(STATIC_PATH, "index.html")));
});

module.exports = app;