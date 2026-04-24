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
    # params: qqq_w, schd_w, spy_w, cash_w, vix_entry, mdd_entry, buy_amt, vix_exit
    initial_cash = 100000000 # 100M KRW or USD baseline
    
    # Weights
    w = np.array([params['qqq_w'], params['schd_w'], params['spy_w'], params['cash_w']])
    # Normalize for safety
    w = w / w.sum()
    
    cash = initial_cash * w[3]
    holdings = {
        'QQQ': (initial_cash * w[0]) / df['QQQ'].iloc[0],
        'SCHD': (initial_cash * w[1]) / df['SCHD'].iloc[0],
        'SPY': (initial_cash * w[2]) / df['SPY'].iloc[0],
        'QLD': 0,
        'TQQQ': 0
    }
    
    history = []
    max_equity = initial_cash
    max_mdd = 0
    spy_initial_price = df['SPY'].iloc[0]
    
    for i in range(len(df)):
        date = df.index[i]
        prices = df.iloc[i]
        vix = prices['^VIX']
        
        # Current Equity
        equity = cash
        for sym, qty in holdings.items():
            equity += qty * prices[sym]
        
        # Track MDD
        if equity > max_equity:
            max_equity = equity
        mdd = (max_equity - equity) / max_equity
        if mdd > max_mdd:
            max_mdd = mdd
            
        # Tactical Logic
        # 1. Exit Trigger
        if vix < params['vix_exit']:
            # Sell all leverage to cash
            cash += holdings['QLD'] * prices['QLD']
            cash += holdings['TQQQ'] * prices['TQQQ']
            holdings['QLD'] = 0
            holdings['TQQQ'] = 0
            
        # 2. QLD Entry (VIX)
        if vix >= params['vix_entry'] and cash > 0:
            buy_val = min(cash, params['buy_amt'])
            holdings['QLD'] += buy_val / prices['QLD']
            cash -= buy_val
            
        # 3. TQQQ Entry (MDD)
        if mdd * 100 >= params['mdd_entry'] and cash > 0:
            buy_val = min(cash, params['buy_amt'])
            holdings['TQQQ'] += buy_val / prices['TQQQ']
            cash -= buy_val
            
        history.append({
            'time': date.strftime('%Y-%m-%d'),
            'value': equity,
            'spy': (prices['SPY'] / spy_initial_price) * initial_cash
        })
        
    final_roi = (equity - initial_cash) / initial_cash
    spy_mdd = (df['SPY'].max() - df['SPY'].iloc[-1]) / df['SPY'].max() # Simple approximation for speed
    # Actual SPY Max MDD for safety constraint
    spy_max_mdd = (df['SPY'].cummax() - df['SPY']).div(df['SPY'].cummax()).max()
    
    return {
        'history': history,
        'roi': final_roi,
        'mdd': max_mdd,
        'spy_mdd': spy_max_mdd,
        'fitness': final_roi / (max_mdd + 1e-6) if max_mdd <= spy_max_mdd else 0
    }

@app.route("/api/python/optimize")
def optimize():
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
