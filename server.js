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
const { createClient } = require("@boltic/sdk");
const dotenv = require('dotenv');
const { GoogleGenAI, mcpToTool } = require("@google/genai");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

dotenv.config();

const client = createClient(process.env.BOLTIC_API_KEY);

async function tablefetcher() {
    const { data: usersTable, error } = await client.tables.findById("98898da1-bb1d-4c0d-a60d-06d14c6caaa4");

    if (error) {
        console.error("Error In table :", error.message || error.meta);
    } else {
        console.log(`Found table: ${usersTable.name} (${usersTable.id})`);
        
        try {
            const query = `SELECT * FROM "${usersTable.name}" LIMIT 10`;
            const result = await client.sql.executeSQL(query);

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
            if (req.query.application_id)
                return `${req.extension.base_url}/company/${req.query['company_id']}/application/${req.query.application_id}`;
            else
                return `${req.extension.base_url}/company/${req.query['company_id']}`;
        },
        
        uninstall: async (req) => {
            // Write your code here to cleanup data related to extension
        }
    },
    storage: new SQLiteStorage(sqliteInstance,"exapmple-fynd-platform-extension"),
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

app.use(cookieParser("ext.session"));
app.use(bodyParser.json({
    limit: '2mb'
}));
app.use(serveStatic(STATIC_PATH, { index: false }));
app.use("/", fdkExtension.fdkHandler);

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
        const { platformClient } = req;
        
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

productRouter.get('/application/:application_id', async function view(req, res, next) {
    try {
        const { platformClient } = req;
        const { application_id } = req.params;
        
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

// NEW MCP-INTEGRATED PROMOTION SUGGESTION ENDPOINT
productRouter.get('/suggest-promotion', async (req, res) => {
    const { product_name, product_category = "Electronics", current_price = 0 } = req.query;
    
    if (!product_name) {
        return res.status(400).json({ 
            error: "product_name is required. Example: /suggest-promotion?product_name=iPhone%2016%20Pro%20Max"
        });
    }

    let mcpClient = null;

    try {
        console.log(`\n=== STARTING PROMOTION SUGGESTION FOR ${product_name} ===`);
        
        const current_date = new Date().toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Initialize Gemini AI
        const ai = new GoogleGenAI({ 
            apiKey: process.env.GEMINI_API_KEY 
        });

        let useMCP = false;
        let tools = [];

        // Try to initialize MCP client for Google Search (with proper env vars)
        if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID) {
            try {
                const transport = new StdioClientTransport({
                    command: "npx",
                    args: ["-y", "@modelcontextprotocol/server-google-search"],
                    env: {
                        ...process.env,
                        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
                        GOOGLE_CSE_ID: process.env.GOOGLE_CSE_ID
                    }
                });

                mcpClient = new Client({
                    name: "promotion-suggester",
                    version: "1.0.0"
                });

                await mcpClient.connect(transport);
                console.log("✓ MCP Client connected successfully");
                tools = [mcpToTool(mcpClient)];
                useMCP = true;
            } catch (mcpError) {
                console.log("⚠️ MCP connection failed, falling back to direct Gemini:", mcpError.message);
                useMCP = false;
            }
        } else {
            console.log("⚠️ GOOGLE_API_KEY or GOOGLE_CSE_ID not set, using direct Gemini without MCP tools");
        }
        
        const prompt = useMCP ? `
You have access to Google Search tools via MCP server.

Task: Suggest 3 promotional schemes for the product below based on:
1. Current market trends (use Google Search)
2. Competitor pricing and offers (use Google Search)
3. Seasonal events and holidays (use Google Search)
4. Consumer behavior patterns

Product Details:
- Name: ${product_name}
- Category: ${product_category}
- Current Price: ₹${current_price}
- Today's Date: ${current_date}

Instructions:
1. First, use Google Search to find:
   - Current market trends for ${product_name}
   - Competitor pricing and ongoing offers (Flipkart, Amazon, Croma)
   - Recent consumer buying patterns for ${product_category}

2. Then, check for:
   - Upcoming festivals/holidays in India
   - Shopping seasons (Diwali, New Year, Valentine's, etc.)

3. Finally, provide response as a JSON array with 3 promotional schemes in this EXACT format:
[
    {
        "scheme_name": "Name of the promotional scheme",
        "discount_percentage": 15,
        "discount_type": "percentage",
        "duration_days": 7,
        "target_segment": "Target customer segment",
        "reason": "Brief explanation of why this promotion works",
        "competitor_analysis": "Summary of competitor offers found",
        "seasonal_factor": "Seasonal/event-based justification"
    }
]

Return ONLY valid JSON array, no additional text.
` : `
Task: Suggest 3 promotional schemes for the product below based on your knowledge of:
1. Current market trends for premium smartphones
2. Typical competitor pricing strategies (Amazon, Flipkart, Croma)
3. Seasonal events and holidays in India (December - Christmas, New Year)
4. Consumer behavior patterns for premium electronics

Product Details:
- Name: ${product_name}
- Category: ${product_category}
- Current Price: ₹${current_price}
- Today's Date: ${current_date}

Create 3 different promotional schemes with varying discount levels (5-15%) and durations.

Provide response as a JSON array with 3 promotional schemes in this EXACT format:
[
    {
        "scheme_name": "Name of the promotional scheme",
        "discount_percentage": 15,
        "discount_type": "percentage",
        "duration_days": 7,
        "target_segment": "Target customer segment",
        "reason": "Brief explanation of why this promotion works",
        "competitor_analysis": "Summary of typical competitor offers",
        "seasonal_factor": "Seasonal/event-based justification"
    }
]

Return ONLY valid JSON array, no additional text.
`;

        console.log(`✓ Generating content with Gemini ${useMCP ? '+ MCP tools' : '(direct)'}...`);

        const config = {
            temperature: 0.7,
            responseMimeType: "application/json"
        };

        if (useMCP && tools.length > 0) {
            config.tools = tools;
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents: prompt,
            config
        });

        // Parse the AI response
        const promotionData = JSON.parse(response.text);
        
        // Console log for debugging
        console.log("\n=== PROMOTION SUGGESTION RESULT ===");
        console.log(JSON.stringify(promotionData, null, 2));
        console.log("===================================\n");

        const result = {
            success: true,
            product: product_name,
            generated_at: current_date,
            promotion_scheme: Array.isArray(promotionData) ? promotionData : [promotionData],
            ai_model: useMCP ? "gemini-2.0-flash-exp-mcp" : "gemini-2.0-flash-exp"
        };

        return res.json(result);

    } catch (error) {
        console.error("❌ Promotion generation error:", error);
        return res.status(500).json({ 
            success: false,
            error: error.message,
            details: "Failed to generate promotion suggestion"
        });
    } finally {
        // Clean up MCP connection
        if (mcpClient) {
            try {
                await mcpClient.close();
                console.log("✓ MCP Client connection closed\n");
            } catch (closeError) {
                console.error("Error closing MCP client:", closeError);
            }
        }
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

productRouter.post('/publish-promotion', async (req, res) => {
    try {
        const API_URL = "https://asia-south1.workflow.boltic.app/3ad00a9a-31c8-4ec2-a9ce-5645f94459bd/promote";
        const promotionData = req.body;
        
        console.log("Publishing promotion:", JSON.stringify(promotionData, null, 2));
        
        const response = await axios.post(API_URL, promotionData, {
            headers: {
                "Content-Type": "application/json"
            }
        });
        
        console.log("Promotion published successfully:", response.data);
        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error("Error publishing promotion:", error);
        res.status(500).json({ error: "Failed to publish promotion" });
    }
});

productRouter.post('/deny-price-update', async (req, res) => {
    try {
        const { data: usersTable, error } = await client.tables.findById("98898da1-bb1d-4c0d-a60d-06d14c6caaa4");
        if (error) {
            return res.status(500).json({ error: error.message });
        }

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

platformApiRoutes.use('/products', productRouter);
app.use('/api', platformApiRoutes);

app.get('*', (req, res) => {
    return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(readFileSync(path.join(STATIC_PATH, "index.html")));
});

module.exports = app;
