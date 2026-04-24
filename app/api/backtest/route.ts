import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  console.log("[API] Backtest request received");
  try {
    const params = await req.json();
    console.log("[API] Params:", JSON.stringify(params));

    const url = "https://yahoo-finance-api-seven.vercel.app/history?symbols=^VIX,SPY,QQQ,SCHD,QLD,TQQQ&period=15y";
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Data fetch failed with status ${resp.status}`);
    
    const data = await resp.json();
    console.log("[API] Data fetched successfully, keys:", Object.keys(data));

    // Align data
    const symbols = ['^VIX', 'SPY', 'QQQ', 'SCHD', 'QLD', 'TQQQ'];
    const dates = (data['SPY'] as any[]).map(d => d.date);
    
    const aligned: any[] = [];
    for (let i = 0; i < dates.length; i++) {
        const row: any = { date: dates[i] };
        for (const sym of symbols) {
            const entry = (data[sym] as any[])[i];
            row[sym] = entry ? entry.close : (aligned.length > 0 ? aligned[aligned.length-1][sym] : 0);
        }
        aligned.push(row);
    }

    // Parameters
    const initialCashTotal = 100000000;
    const initialInvestment = params.initial_investment || 70000000;
    const reservesForTactical = initialCashTotal - initialInvestment;
    
    const qqq_w = params.qqq_w;
    const schd_w = params.schd_w;
    const spy_w = params.spy_w;
    const weightSum = qqq_w + schd_w + spy_w;
    
    // Normalize weights
    const nQQQ = weightSum > 0 ? qqq_w / weightSum : 0.3;
    const nSCHD = weightSum > 0 ? schd_w / weightSum : 0.4;
    const nSPY = weightSum > 0 ? spy_w / weightSum : 0.3;

    let cash = 0;
    let reserves = reservesForTactical;
    
    const firstPrices = aligned[0];
    let holdings = {
        QQQ: (initialInvestment * nQQQ) / firstPrices['QQQ'],
        SCHD: (initialInvestment * nSCHD) / firstPrices['SCHD'],
        SPY: (initialInvestment * nSPY) / firstPrices['SPY'],
        QLD: 0,
        TQQQ: 0
    };

    const spyInitialPrice = firstPrices['SPY'];
    const history: any[] = [];

    for (let i = 0; i < aligned.length; i++) {
        const row = aligned[i];
        const vix = row['^VIX'];
        
        let equity = reserves + cash;
        equity += holdings.QQQ * row.QQQ;
        equity += holdings.SCHD * row.SCHD;
        equity += holdings.SPY * row.SPY;
        equity += holdings.QLD * row.QLD;
        equity += holdings.TQQQ * row.TQQQ;

        // Tactical Logic
        // 1. Exit
        if (vix < params.vix_exit) {
            reserves += holdings.QLD * row.QLD;
            reserves += holdings.TQQQ * row.TQQQ;
            holdings.QLD = 0;
            holdings.TQQQ = 0;
        }

        // 2. Entry
        if (vix >= params.vix_entry && reserves > 0) {
            const buyVal = Math.min(reserves, params.buy_amt);
            holdings.QLD += buyVal / row.QLD;
            reserves -= buyVal;
        }

        history.push({
            time: row.date,
            value: equity,
            spy: (row.SPY / spyInitialPrice) * initialCashTotal
        });
    }

    const finalEquity = history[history.length - 1].value;
    const finalRoi = (finalEquity - initialCashTotal) / initialCashTotal;

    // Calc MDD
    let maxVal = -Infinity;
    let strategyMDD = 0;
    history.forEach(h => {
        if (h.value > maxVal) maxVal = h.value;
        const ddn = (maxVal - h.value) / maxVal;
        if (ddn > strategyMDD) strategyMDD = ddn;
    });

    let maxSpyVal = -Infinity;
    let spyMDD = 0;
    history.forEach(h => {
        if (h.spy > maxSpyVal) maxSpyVal = h.spy;
        const ddn = (maxSpyVal - h.spy) / maxSpyVal;
        if (ddn > spyMDD) spyMDD = ddn;
    });

    console.log("[API] Simulation complete. ROI:", finalRoi, "MDD:", strategyMDD, "SPY MDD:", spyMDD);

    return NextResponse.json({
        history,
        roi: finalRoi,
        equity: finalEquity,
        mdd: strategyMDD,
        spy_mdd: spyMDD,
        alpha: finalRoi - ((history[history.length-1].spy - initialCashTotal) / initialCashTotal)
    });

  } catch (error: any) {
    console.error("[API] ERROR:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
