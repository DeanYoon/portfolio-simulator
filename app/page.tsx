"use strict";

const React = require("react");
const { useEffect, useState, useRef } = React;
const { createChart } = require("lightweight-charts");

export default function AlphaShield() {
  const [logs, setLogs] = useState([]);
  const [bestResult, setBestResult] = useState(null);
  const [stats, setStats] = useState({ roi: 0, mdd: 0, alpha: 0 });
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const seriesRef = useRef({ strategy: null, spy: null });

  const addLog = (msg) => {
    setLogs((prev) => [msg, ...prev].slice(0, 100));
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { backgroundColor: "#0b141d", textColor: "#d1d4dc" },
      grid: { vertLines: { color: "#1c2631" }, horzLines: { color: "#1c2631" } },
      width: chartContainerRef.current.clientWidth,
      height: 480,
    });

    const strategySeries = chart.addLineSeries({
      color: "#00f3ff",
      lineWidth: 3,
      title: "Alpha Shield",
    });

    const spySeries = chart.addLineSeries({
      color: "rgba(255, 255, 255, 0.4)",
      lineWidth: 1,
      lineStyle: 2, // Dashed
      title: "SPY Benchmark",
    });

    chartRef.current = chart;
    seriesRef.current = { strategy: strategySeries, spy: spySeries };

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  const startOptimization = () => {
    setLogs([]);
    addLog("Initializing Optimizer...");
    
    const eventSource = new EventSource("/api/python/optimize");

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.done) {
        addLog("✅ Optimization Complete!");
        eventSource.close();
        return;
      }

      if (data.status === "NEW BEST FOUND!") {
        addLog(`🚀 NEW BEST: Fitness ${data.result.fitness.toFixed(4)} (ROI: ${(data.result.roi * 100).toFixed(2)}%)`);
        setBestResult(data);
        
        // Update Chart
        const history = data.result.history;
        seriesRef.current.strategy.setData(history.map(d => ({ time: d.time, value: d.value })));
        seriesRef.current.spy.setData(history.map(d => ({ time: d.time, value: d.spy })));
        
        setStats({
          roi: (data.result.roi * 100).toFixed(2),
          mdd: (data.result.mdd * 100).toFixed(2),
          alpha: ((data.result.roi - (data.result.spy_mdd * 0)) * 100).toFixed(2) // Dummy alpha logic for now
        });
      } else {
        addLog(`Progress: Iteration ${data.iteration || '...'} ${data.status}`);
      }
    };

    eventSource.onerror = (err) => {
      addLog("❌ Error connecting to optimization engine.");
      eventSource.close();
    };
  };

  return (
    <div className="min-h-screen bg-[#0b141d] text-[#d1d4dc] p-4 font-mono">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center bg-[#1c2631] p-6 rounded-xl border border-gray-800 shadow-2xl">
          <div>
            <h1 className="text-2xl font-black text-[#00f3ff] tracking-tighter">ALPHA SHIELD <span className="text-xs font-normal text-gray-500 ml-2">VIX OPTIMIZER v1.0</span></h1>
            <p className="text-xs text-gray-400 mt-1">Next.js + Flask Hybrid Hyper-parameter Backtesting Engine</p>
          </div>
          <button 
            onClick={startOptimization}
            className="bg-[#00f3ff] hover:bg-[#00d8e4] text-[#0b141d] px-8 py-3 rounded-lg font-bold transition-all shadow-[0_0_15px_rgba(0,243,255,0.4)] active:scale-95"
          >
            START OPTIMIZER
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="Total ROI" value={`${stats.roi}%`} color="#00f3ff" />
          <StatCard title="Max Drawdown" value={`${stats.mdd}%`} color="#ff4d4d" />
          <StatCard title="Alpha Score" value={stats.alpha} color="#ffffff" />
        </div>

        {/* Main Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Chart Area */}
          <div className="lg:col-span-3 bg-[#1c2631] p-4 rounded-xl border border-gray-800 relative overflow-hidden">
            <div ref={chartContainerRef} className="w-full h-[480px]" />
            {bestResult && (
               <div className="absolute top-8 left-8 bg-[#0b141d]/80 p-4 rounded border border-gray-700 text-[10px] space-y-1">
                  <p className="text-[#00f3ff] font-bold underline mb-2">OPTIMAL PARAMETERS</p>
                  {Object.entries(bestResult.params).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <span>{k.toUpperCase()}</span>
                      <span className="text-white">{typeof v === 'number' ? v.toFixed(4) : v}</span>
                    </div>
                  ))}
               </div>
            )}
          </div>

          {/* Log Panel */}
          <div className="bg-[#1c2631] rounded-xl border border-gray-800 flex flex-col h-[512px]">
            <div className="p-3 border-b border-gray-800 text-xs font-bold text-gray-400 bg-black/20">SYSTEM LOG</div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 text-[10px]">
              {logs.map((log, i) => (
                <div key={i} className="border-l-2 border-gray-700 pl-2 py-0.5 fade-in">
                  <span className="text-gray-600 mr-2">[{new Date().toLocaleTimeString()}]</span>
                  <span className={log.includes("NEW") ? "text-[#00f3ff] font-bold" : "text-gray-400"}>{log}</span>
                </div>
              ))}
              {logs.length === 0 && <div className="text-gray-600 italic">Engine standby... Press START.</div>}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-5px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}

function StatCard({ title, value, color }) {
  return (
    <div className="bg-[#1c2631] p-6 rounded-xl border border-gray-800">
      <div className="text-xs text-gray-500 font-bold mb-1 uppercase tracking-widest">{title}</div>
      <div className="text-3xl font-black" style={{ color }}>{value}</div>
    </div>
  );
}
