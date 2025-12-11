from fastapi import FastAPI, Request
from typing import List
from pydantic import BaseModel
import logging
import xgboost as xgb
import numpy as np
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# LOAD MODEL
model = xgb.XGBRegressor()
model_path = "pricing_model2.json"
model_loaded = False

if os.path.exists(model_path):
    model.load_model(model_path)
    model_loaded = True

class PricingInput(BaseModel):
    sku: str
    current_price: float
    competitor_price: float 
    cost_price: float
    stock_level: int
    units_sold: int
    units_ordered: int

class BatchRequest(BaseModel):
    products: List[PricingInput]

@app.post("/optimize-batch")
async def optimize_batch(data: BatchRequest, request: Request):
    results = []

    for item in data.products:
        reason = "Rule-based Fallback"
        new_price = item.competitor_price * 0.98 # Default fallback

        if model_loaded:
            try:
                # 1. CALCULATE INPUT RATIOS (Match Training)
                cost_ratio = item.cost_price / item.competitor_price
                
                # Features: [cost_ratio, stock, sold, ordered]
                features = np.array([[
                    cost_ratio, 
                    item.stock_level, 
                    item.units_sold, 
                    item.units_ordered
                ]])
                
                # 2. PREDICT MULTIPLIER (e.g., 0.95)
                multiplier = float(model.predict(features)[0])
                
                # 3. APPLY TO COMPETITOR PRICE
                new_price = item.competitor_price * multiplier
                
                reason = f"AI Strategy: {multiplier:.2f}x Competitor"
            except Exception as e:
                logger.error(f"Error: {e}")

        # --- FINAL SAFETY CHECKS ---
        # Don't sell below cost (unless clearance)
        min_margin = item.cost_price * 1.05
        if item.units_sold > 10: # Only protect margin if item sells well
             if new_price < min_margin:
                new_price = min_margin
                reason += " (Margin Guard)"

        results.append({
            "sku": item.sku,
            "optimized_price": round(new_price, 2),
            "original_price": item.current_price,
            "reason": reason
        })

    return {"optimized_products": results}