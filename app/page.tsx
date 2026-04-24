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
  const [stats, setStats] = useState({ roi: "0", equity: "0" });
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>();
  const seriesRef = useRef<{ strategy: ISeriesApi<"Line"> | null; spy: ISeriesApi<"Line"> | null }>({ strategy: null, spy: null });

  const addLog = (msg: string) => {
    setLogs((prev: string[]) => [msg, ...prev].slice(0, 50));
  };

  const runSimulation = async (currParams = params) => {
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
      
      if (seriesRef.current.strategy && seriesRef.current.spy) {
        seriesRef.current.strategy.setData(data.history.map((d: any) => ({ time: d.time, value: d.value })));
        seriesRef.current.spy.setData(data.history.map((d: any) => ({ time: d.time, value: d.spy })));
        setStats({
          roi: (data.roi * 100).toFixed(2),
          equity: Math.floor(data.equity).toLocaleString()
        });
      }
    } catch (e) {
      addLog("Error running simulation");
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

  const updateParam = (key: string, val: number) => {
    const newParams = { ...params, [key]: val };
    setParams(newParams);
    runSimulation(newParams);
  };

  return (
    <div className="min-h-screen bg-[#0b141d] text-[#d1d4dc] p-4 font-mono select-none">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Sidebar Controls */}
        <div className="space-y-4 bg-[#1c2631] p-6 rounded-2xl border border-gray-800">
          <h2 className="text-[#00f3ff] font-black text-xl mb-6">STRATEGY CONFIG</h2>
          
          <div className="space-y-6">
            <Slider label={`QQQ Weight: ${params.qqq_w}%`} value={params.qqq_w} onChange={(v: number) => updateParam('qqq_w', v)} />
            <Slider label={`SCHD Weight: ${params.schd_w}%`} value={params.schd_w} onChange={(v: number) => updateParam('schd_w', v)} />
            <Slider label={`SPY Weight: ${params.spy_w}%`} value={params.spy_w} onChange={(v: number) => updateParam('spy_w', v)} />
            
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
              <Slider label={`VIX Entry >= ${params.vix_entry}`} min={10} max={60} value={params.vix_entry} onChange={(v: number) => updateParam('vix_entry', v)} />
              <Slider label={`VIX Exit < ${params.vix_exit}`} min={10} max={30} value={params.vix_exit} onChange={(v: number) => updateParam('vix_exit', v)} />
              <Slider label={`Daily Buy: ${params.buy_amt.toLocaleString()}`} min={100000} max={10000000} step={100000} value={params.buy_amt} onChange={(v: number) => updateParam('buy_amt', v)} />
            </div>
          </div>
        </div>

        {/* Main Dashboard */}
        <div className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#1c2631] p-6 rounded-2xl border border-gray-800">
              <div className="text-gray-500 text-xs mb-1">TOTAL EQUITY</div>
              <div className="text-3xl font-black text-white">{stats.equity} <span className="text-sm font-normal text-gray-600">KRW</span></div>
            </div>
            <div className="bg-[#1c2631] p-6 rounded-2xl border border-gray-800 text-right">
              <div className="text-gray-500 text-xs mb-1">CUMULATIVE ROI</div>
              <div className="text-3xl font-black text-[#00f3ff]">{stats.roi}%</div>
            </div>
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

function StatCard({ title, value, color }: { title: string; value: string | number; color?: string }) {
  return (
    <div className="bg-[#1c2631] p-6 rounded-xl border border-gray-800">
      <div className="text-xs text-gray-500 font-bold mb-1 uppercase tracking-widest">{title}</div>
      <div className="text-3xl font-black" style={{ color: color || "#fff" }}>{value}</div>
    </div>
  );
}
