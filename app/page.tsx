"use client";

import React, { useEffect, useState, useRef } from "react";
import { createChart, LineStyle, LineSeries, ISeriesApi } from "lightweight-charts";

export default function AlphaShield() {
  const [logs, setLogs] = useState<string[]>([]);
  const [params, setParams] = useState({
    qqq_w: 30,
    schd_w: 40,
    spy_w: 30,
    initial_investment: 70000000, // 70M init
    vix_entry: 35,
    buy_amt: 1000000, // 1M buy
    vix_exit: 20
  });
  const [stats, setStats] = useState({ roi: "0", equity: "0", mdd: "0", spyMdd: "0", gap: "0" });
  const [isOptimizing, setIsOptimizing] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>();
  const seriesRef = useRef<{ strategy: ISeriesApi<"Line"> | null; spy: ISeriesApi<"Line"> | null }>({ strategy: null, spy: null });

  const addLog = (msg: string) => {
    setLogs((prev: string[]) => [msg, ...prev].slice(0, 50));
  };

  const runSimulation = async (currParams = params, silent = false) => {
    if (!silent) addLog(`Running simulation: Q:${currParams.qqq_w}% S:${currParams.schd_w}% B:${currParams.vix_entry}`);
    try {
      const resp = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           ...currParams,
           qqq_w: currParams.qqq_w / 100,
           schd_w: currParams.schd_w / 100,
           spy_w: currParams.spy_w / 100,
        })
      });
      
      const data = await resp.json();
      
      if (data.error) {
        addLog(`❌ API Error: ${data.error}`);
        return;
      }

      if (seriesRef.current.strategy && seriesRef.current.spy) {
        seriesRef.current.strategy.setData(data.history.map((d: any) => ({ time: d.time, value: d.value })));
        seriesRef.current.spy.setData(data.history.map((d: any) => ({ time: d.time, value: d.spy })));
        setStats({
          roi: (data.roi * 100).toFixed(2),
          equity: Math.floor(data.equity).toLocaleString(),
          mdd: (data.mdd * 100).toFixed(2),
          spyMdd: (data.spy_mdd * 100).toFixed(2),
          gap: (data.alpha * 100).toFixed(2)
        });
        addLog(`✅ Re-calculated. ROI: ${(data.roi * 100).toFixed(2)}% | MDD: ${(data.mdd * 100).toFixed(2)}% (SPY: ${(data.spy_mdd * 100).toFixed(2)}%)`);
      }
      return data;
    } catch (e: any) {
      addLog(`❌ Simulation Failed: ${e.message}`);
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: 'solid' as any, color: "#0b141d" }, textColor: "#d1d4dc" },
      grid: { vertLines: { color: "#1c2631" }, horzLines: { color: "#1c2631" } },
      width: chartContainerRef.current.clientWidth,
      height: 500,
    });

    const strategySeries = chart.addSeries(LineSeries, {
      color: "#00f3ff",
      lineWidth: 3,
      title: "Alpha Shield Portfolio",
    });

    const spySeries = chart.addSeries(LineSeries, {
      color: "rgba(255, 255, 255, 0.4)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: "SPY (Reference)",
    });

    seriesRef.current = { strategy: strategySeries as any, spy: spySeries as any };
    chartRef.current = chart;

    runSimulation(); // Initial run

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  const runMonteCarlo = async () => {
    setIsOptimizing(true);
    addLog("🚀 Starting High-Speed Monte Carlo (100 iterations)...");
    
    let bestFitness = -Infinity;
    
    // Set baseline from current params (if valid)
    const current = await runSimulation(params);
    if (current && current.mdd < current.spy_mdd) {
        bestFitness = current.roi;
    }

    // Optimization loop: aim for ~10 iterations per second
    for (let i = 0; i < 100; i++) {
        const q_steps = Math.floor(Math.random() * 21);
        const s_steps = Math.floor(Math.random() * (21 - q_steps)); 
        const spy_steps = 20 - q_steps - s_steps;

        const testP = {
            qqq_w: q_steps * 5,
            schd_w: s_steps * 5,
            spy_w: spy_steps * 5,
            initial_investment: Math.floor((10000000 + Math.random() * 80000000) / 1000000) * 1000000,
            vix_entry: Math.floor((15 + Math.random() * 45) / 5) * 5,
            buy_amt: Math.floor((100000 + Math.random() * 5000000) / 100000) * 100000,
            vix_exit: Math.floor((10 + Math.random() * 25) / 5) * 5
        };

        const res = await runSimulation(testP, true); // silent mode to maintain speed
        if (res) {
            // STRICT CONSTRAINT: MDD must be lower than SPY
            const isSaferThanSpy = res.mdd < res.spy_mdd;
            
            if (isSaferThanSpy) {
                // If safer, we maximize ROI
                const fitness = res.roi;
                if (fitness > bestFitness) {
                    bestFitness = fitness;
                    setParams(testP);
                    addLog(`🔥 NEW BEST [Iter ${i}]: ROI ${(res.roi*100).toFixed(2)}% | MDD ${(res.mdd*100).toFixed(2)}% < SPY ${(res.spy_mdd*100).toFixed(2)}%`);
                }
            }
        }
        
        // Control loop speed: ~100ms delay every iteration = ~10 per second
        await new Promise(r => setTimeout(r, 100));
    }
    
    setIsOptimizing(false);
    addLog("✅ Optimization Complete.");
    runSimulation(); // Final refresh with best found
  };

  const updateParam = (key: string, val: number) => {
    let newParams = { ...params, [key]: val };

    // Maintain 100% sum constraint for weights with 5% steps
    if (key === 'qqq_w' || key === 'schd_w' || key === 'spy_w') {
        const snappedVal = Math.round(val / 5) * 5;
        const otherKeys = ['qqq_w', 'schd_w', 'spy_w'].filter(k => k !== key);
        const remaining = 100 - snappedVal;
        
        // Simple proportional redist among others in 5% steps
        const currentOtherSum = params[otherKeys[0] as 'qqq_w' | 'schd_w' | 'spy_w'] + params[otherKeys[1] as 'qqq_w' | 'schd_w' | 'spy_w'];
        
        let val1, val2;
        if (currentOtherSum === 0) {
            val1 = Math.round((remaining / 2) / 5) * 5;
            val2 = remaining - val1;
        } else {
            val1 = Math.round((remaining * (params[otherKeys[0] as 'qqq_w' | 'schd_w' | 'spy_w'] / currentOtherSum)) / 5) * 5;
            val2 = remaining - val1;
        }

        newParams = { 
            ...newParams, 
            [key]: snappedVal,
            [otherKeys[0]]: val1,
            [otherKeys[1]]: val2
        };
    } else if (key === 'vix_entry' || key === 'vix_exit') {
        newParams[key] = Math.round(val / 5) * 5;
    }

    setParams(newParams);
    runSimulation(newParams);
  };

  return (
    <div className="min-h-screen bg-[#0b141d] text-[#d1d4dc] p-4 font-mono select-none">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Sidebar Controls */}
        <div className="space-y-4 bg-[#1c2631] p-6 rounded-2xl border border-gray-800">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[#00f3ff] font-black text-xl">STRATEGY</h2>
            <button 
              onClick={runMonteCarlo}
              disabled={isOptimizing}
              className={`text-[10px] px-3 py-1.5 rounded-md font-bold transition-all ${isOptimizing ? 'bg-gray-700 text-gray-500' : 'bg-[#00f3ff] text-[#0b141d] hover:scale-105 active:scale-95 shadow-[0_0_10px_rgba(0,243,255,0.3)]'}`}
            >
              {isOptimizing ? 'OPTIMIZING...' : 'MONTE CARLO'}
            </button>
          </div>
          
          <div className="space-y-6">
            <Slider label={`QQQ Weight: ${params.qqq_w}%`} step={5} value={params.qqq_w} onChange={(v: number) => updateParam('qqq_w', v)} />
            <Slider label={`SCHD Weight: ${params.schd_w}%`} step={5} value={params.schd_w} onChange={(v: number) => updateParam('schd_w', v)} />
            <Slider label={`SPY Weight: ${params.spy_w}%`} step={5} value={params.spy_w} onChange={(v: number) => updateParam('spy_w', v)} />
            
            <div className="pt-4 border-t border-gray-800">
              <label className="text-[10px] text-gray-500 block mb-2 uppercase">Initial Investment (Reserves: 100M)</label>
              <input 
                type="range" min="10000000" max="100000000" step="1000000"
                value={params.initial_investment}
                onChange={(e) => updateParam('initial_investment', parseInt(e.target.value))}
                className="w-full accent-[#00f3ff]"
              />
              <div className="text-right text-xs mt-1">{(params.initial_investment/1000000).toFixed(0)}M KRW</div>
            </div>

            <div className="pt-4 border-t border-gray-800 space-y-4">
              <Slider label={`VIX Entry >= ${params.vix_entry}`} min={10} max={60} step={5} value={params.vix_entry} onChange={(v: number) => updateParam('vix_entry', v)} />
              <Slider label={`VIX Exit < ${params.vix_exit}`} min={10} max={30} step={5} value={params.vix_exit} onChange={(v: number) => updateParam('vix_exit', v)} />
              <Slider label={`Daily Buy: ${params.buy_amt.toLocaleString()}`} min={100000} max={10000000} step={100000} value={params.buy_amt} onChange={(v: number) => updateParam('buy_amt', v)} />
            </div>
          </div>
        </div>

        {/* Main Dashboard */}
        <div className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Equity" value={stats.equity} />
            <StatCard title="Return" value={`${stats.roi}%`} color="#00f3ff" />
            <StatCard title="Max Drawdown" value={`${stats.mdd}%`} color="#ff4d4d" subValue={`SPY: ${stats.spyMdd}%`} />
            <StatCard title="Alpha (Gap)" value={`${stats.gap}%`} color={parseFloat(stats.gap) >= 0 ? "#00f3ff" : "#ff4d4d"} />
          </div>

          <div className="bg-[#1c2631] p-4 rounded-2xl border border-gray-800 relative">
            <div ref={chartContainerRef} className="w-full h-[500px]" />
          </div>

          {/* Logs */}
          <div className="bg-[#1c2631] p-4 rounded-xl border border-gray-800 text-[10px] h-32 overflow-y-auto">
             <div className="text-gray-600 mb-2 uppercase font-bold sticky top-0 bg-[#1c2631]">Real-time Simulation Log</div>
             {logs.map((l, i) => <div key={i} className="text-gray-400 opacity-50">{l}</div>)}
             <div className="text-[#00f3ff]">Simulation re-calculated in real-time.</div>
          </div>
        </div>

      </div>
    </div>
  );
}

function Slider({ label, value, onChange, min=0, max=100, step=1 }: any) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-gray-400 mb-2 uppercase font-bold">
        <span>{label}</span>
      </div>
      <input 
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#00f3ff]"
      />
    </div>
  );
}

function StatCard({ title, value, color, subValue }: { title: string; value: string | number; color?: string; subValue?: string }) {
  return (
    <div className="bg-[#1c2631] p-6 rounded-xl border border-gray-800">
      <div className="text-xs text-gray-500 font-bold mb-1 uppercase tracking-widest">{title}</div>
      <div className="text-2xl font-black" style={{ color: color || "#fff" }}>{value}</div>
      {subValue && <div className="text-[10px] text-gray-600 mt-1">{subValue}</div>}
    </div>
  );
}
