from flask import Flask, request, jsonify, Response
import requests
import pandas as pd
import numpy as np
import time
import json
import random

app = Flask(__name__)

# --- Helper Functions ---
def fetch_data():
    url = "https://yahoo-finance-api-seven.vercel.app/history?symbols=^VIX,SPY,QQQ,SCHD,QLD,TQQQ&period=15y"
    resp = requests.get(url)
    data = resp.json()
    
    # Align data into a single DataFrame
    dfs = []
    for symbol, history in data.items():
        temp_df = pd.DataFrame(history)
        temp_df['date'] = pd.to_datetime(temp_df['date'])
        temp_df = temp_df[['date', 'close']].rename(columns={'close': symbol})
        temp_df = temp_df.set_index('date')
        dfs.append(temp_df)
    
    df = pd.concat(dfs, axis=1).sort_index().ffill().dropna()
    return df

def run_backtest(df, params):
    # params: qqq_w, schd_w, spy_w, initial_investment, vix_entry, buy_amt, vix_exit
    initial_cash = params.get('initial_investment', 100000000)
    
    # Weights for Initial Investment
    w_sum = params['qqq_w'] + params['schd_w'] + params['spy_w']
    w = np.array([params['qqq_w'], params['schd_w'], params['spy_w']])
    if w_sum > 0:
        w = w / w_sum
    else:
        w = np.array([0.3, 0.4, 0.3])
    
    # Initial Setup
    total_equity = initial_cash
    cash = 0  # Assuming full initial investment of the 'initial_investment' amount
    
    holdings = {
        'QQQ': (initial_cash * w[0]) / df['QQQ'].iloc[0],
        'SCHD': (initial_cash * w[1]) / df['SCHD'].iloc[0],
        'SPY': (initial_cash * w[2]) / df['SPY'].iloc[0],
        'QLD': 0,
        'TQQQ': 0
    }
    
    # Reserves for tactical buying (The rest of the 100M if initial_investment < 100M)
    reserves = 100000000 - initial_cash 
    
    history = []
    max_equity = 100000000
    spy_initial_price = df['SPY'].iloc[0]
    
    for i in range(len(df)):
        date = df.index[i]
        prices = df.iloc[i]
        vix = prices['^VIX']
        
        # Current Equity
        equity = reserves + cash
        for sym, qty in holdings.items():
            equity += qty * prices[sym]
        
        # Track Max Equity for MDD if needed (omitted for speed unless required)
            
        # Tactical Logic
        # 1. Exit Trigger: Sell QLD/TQQQ when VIX is low
        if vix < params['vix_exit']:
            reserves += holdings['QLD'] * prices['QLD']
            reserves += holdings['TQQQ'] * prices['TQQQ']
            holdings['QLD'] = 0
            holdings['TQQQ'] = 0
            
        # 2. Entry Trigger: Buy when VIX is high
        if vix >= params['vix_entry'] and reserves > 0:
            buy_val = min(reserves, params['buy_amt'])
            # Split tactical buy between QLD and TQQQ or just QLD? Spec said "buy leverage"
            holdings['QLD'] += buy_val / prices['QLD']
            reserves -= buy_val
            
        history.append({
            'time': date.strftime('%Y-%m-%d'),
            'value': equity,
            'spy': (prices['SPY'] / spy_initial_price) * 100000000
        })
        
    final_roi = (equity - 100000000) / 100000000
    return {
        'history': history,
        'roi': final_roi,
        'equity': equity
    }

@app.route("/api/backtest", methods=["POST"])
def backtest():
    data = request.json
    df = fetch_data()
    result = run_backtest(df, data)
    return jsonify(result)
    def generate():
        df = fetch_data()
        best_params = None
        best_fitness = -1
        
        for i in range(500):
            # Random Search
            params = {
                'qqq_w': random.uniform(0, 1),
                'schd_w': random.uniform(0, 1),
                'spy_w': random.uniform(0, 1),
                'cash_w': random.uniform(0, 1),
                'vix_entry': random.uniform(15, 55),
                'mdd_entry': random.uniform(5, 45),
                'buy_amt': 1000000, # Fixed 1M
                'vix_exit': random.uniform(10, 25)
            }
            
            result = run_backtest(df, params)
            
            status = "Searching..."
            if result['fitness'] > best_fitness:
                best_fitness = result['fitness']
                best_params = params
                status = "NEW BEST FOUND!"
                
                yield f"data: {json.dumps({'iteration': i, 'status': status, 'result': result, 'params': params})}\n\n"
            elif i % 50 == 0:
                yield f"data: {json.dumps({'iteration': i, 'status': 'Optimizing...', 'current_best': best_fitness})}\n\n"
        
        yield f"data: {json.dumps({'done': True, 'best_params': best_params, 'best_fitness': best_fitness})}\n\n"

    return Response(generate(), mimetype='text/event-stream')

if __name__ == "__main__":
    app.run(port=5328)
