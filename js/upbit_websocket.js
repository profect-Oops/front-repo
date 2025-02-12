let candleData = [];
let chart;
let candleSeries;
let socket;
let isLoading = false;
let tempCandle = null;
let lastCandleTimestamp = 0;
const priceElement = document.getElementById("current-price");

// script 태그에서 data-ticker 값 가져오기
const scriptTag = document.querySelector('script[src*="upbit_websocket.js"]');
const market = scriptTag && scriptTag.dataset.ticker ? `KRW-${scriptTag.dataset.ticker}` : "KRW-BTC"; // 기본값: KRW-BTC
console.log(`market: ${market}`);

// ✅ Lightweight 차트 초기화
function initializeLightweightChart() {
    const chartContainer = document.getElementById("tradingview-chart");
    if (!chartContainer) {
        console.error("차트 컨테이너가 존재하지 않습니다.");
        return;
    }
    chart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: 300,
        layout: {
            backgroundColor: '#FFFFFF',
            textColor: '#000000',
        },
        grid: {
            vertLines: { color: '#f1f3f6' },
            horzLines: { color: '#f1f3f6' },
        },
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
            tickMarkFormatter: (time) => formatKSTTime(time),
        },
    });
    candleSeries = chart.addCandlestickSeries();

    chart.applyOptions({
        localization: {
            timeFormatter: (time) => formatKSTTooltip(time),
        },
    });
    chart.timeScale().subscribeVisibleTimeRangeChange((timeRange) => {
        if (timeRange.from < candleData[0]?.time + 60 && !isLoading) {
            loadMoreHistoricalCandles();
        }
    });
}
// ✅ REST API로 과거 1분 캔들 데이터 가져오기
async function fetchHistoricalCandles(count = 60, to = null) {
    let url = `https://api.upbit.com/v1/candles/minutes/1?market=${market}&count=${count}`;
    if (to) {
        url += `&to=${encodeURIComponent(to)}`;
    }
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: { "accept": "application/json" },
        });
        if (!response.ok) {
            throw new Error(`HTTP 오류! 상태 코드: ${response.status}`);
        }
        const data = await response.json();
        const candles = data.map(candle => ({
            time: new Date(candle.candle_date_time_kst).getTime() / 1000,
            open: candle.opening_price,
            high: candle.high_price,
            low: candle.low_price,
            close: candle.trade_price,
        }));
        return candles.reverse();
    } catch (error) {
        console.error("과거 캔들 데이터를 가져오는 중 오류 발생:", error);
        return [];
    }
}
// ✅ 과거 데이터 불러오기
async function loadMoreHistoricalCandles() {
    if (isLoading || candleData.length === 0) return;
    isLoading = true;
    const oldestTime = candleData[0].time * 1000;
    const toDate = new Date(oldestTime).toISOString().split(".")[0];
    const historicalCandles = await fetchHistoricalCandles(30, toDate);
    if (historicalCandles.length > 0) {
        candleData = [...historicalCandles, ...candleData];
        candleSeries.setData(candleData);
    }
    isLoading = false;
}
// ✅ 1분봉 변환 로직
function processCandleData(candle) {
    const timestamp = Math.floor(candle.timestamp / 1000);
    const minuteTimestamp = timestamp - (timestamp % 60);
    if (!tempCandle || minuteTimestamp > lastCandleTimestamp) {
        if (tempCandle) {
            candleSeries.update(tempCandle);
            candleData.push(tempCandle);
        }
        tempCandle = {
            time: minuteTimestamp,
            open: candle.opening_price,
            high: candle.high_price,
            low: candle.low_price,
            close: candle.trade_price,
        };
        lastCandleTimestamp = minuteTimestamp;
    } else {
        tempCandle.high = Math.max(tempCandle.high, candle.high_price);
        tempCandle.low = Math.min(tempCandle.low, candle.low_price);
        tempCandle.close = candle.trade_price;
    }
    candleSeries.update(tempCandle);
}
// ✅ WebSocket 연결
function connectWebSocket() {
    if (socket) {
        socket.close();
    }
    socket = new WebSocket('wss://api.upbit.com/websocket/v1');
    socket.onopen = function () {
        console.log("✅ WebSocket 연결됨");
        const msg = JSON.stringify([
            { "ticket": "test" },
            { "type": "ticker", "codes": [market] },
            { "type": "candle.1s", "codes": [market], "is_only_realtime": true },
            { "format": "DEFAULT" }
        ]);
        socket.send(msg);
    };
    socket.onmessage = function (event) {
        event.data.text().then(text => {
            const data = JSON.parse(text);
            if (data.type === "ticker" && data.trade_price) {
                console.log("현재 가격 수신:", data.trade_price);
                updateCurrentPrice(data.trade_price);
            }
            if (data.type === "candle.1s") {
                processCandleData(data);
            }
        });
    };
    socket.onclose = function () {
        console.log("WebSocket 연결 종료, 재연결 시도...");
        setTimeout(connectWebSocket, 2000);
    };
    socket.onerror = function (error) {
        console.error("WebSocket 오류 발생:", error);
        socket.close();
    };
}
// ✅ 현재 가격 업데이트
function updateCurrentPrice(price) {
    if (priceElement) {
        priceElement.textContent = `${price.toLocaleString("ko-KR")} 원`;
    }
}
// ✅ KST 시간 변환
function formatKSTTime(time) {
    const date = new Date(time * 1000);
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}
function formatKSTTooltip(time) {
    const date = new Date(time * 1000);
    return date.toLocaleString("ko-KR", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
}
// ✅ 실행
window.onload = async function () {
    initializeLightweightChart();
    candleData = await fetchHistoricalCandles(60);
    candleSeries.setData(candleData);
    connectWebSocket();
};