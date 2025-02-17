// script 태그에서 data-ticker 값 가져오기
const scriptTag = document.querySelector('script[src*="detail_front.js"]');
const market = scriptTag && scriptTag.dataset.ticker ? `${scriptTag.dataset.ticker}` : "KRW-BTC";

const socket = new SockJS("/ws");
socket.binaryType = "arraybuffer";  // ✅ 바이너리 데이터 전송으로 변경
const stompClient = Stomp.over(socket);

// 차트 관련 변수
let chart;
let candleSeries;
let candleData = [];
let tempCandle = null;
let lastCandleTimestamp = 0;

stompClient.connect({}, function (frame) {
    console.log("✅ WebSocket 연결됨:", frame);

    // ✅ 특정 마켓 가격 데이터만 구독
    stompClient.subscribe(`/topic/priceDetail/${market}`, function (message) {
        const startTime = performance.now(); // ✅ 시작 시간 기록
        console.log("📥 가격 데이터 수신:", message.body);
        const priceData = JSON.parse(message.body);
        updateCurrentPrice(priceData.price);
        const endTime = performance.now(); // ✅ 끝 시간 기록
        console.log(`⏱️ 데이터 처리 시간: ${(endTime - startTime).toFixed(2)}ms`);
    });

    // ✅ 특정 마켓 캔들 데이터만 구독
    stompClient.subscribe(`/topic/candle/${market}`, function (message) {
        const candleData = JSON.parse(message.body);
        processCandleData(candleData);
    });



}, function (error) {
    console.error("❌ WebSocket 연결 실패:", error);
    setTimeout(() => reconnectWebSocket(), 3000);
});

// ✅ 차트 초기화
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
}

// ✅ 과거 1분 캔들 데이터 가져오기
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

// ✅ 캔들 데이터 반영
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

// ✅ 현재 가격 업데이트
let lastPrice = null;

function updateCurrentPrice(price) {
    if (typeof price !== "number" || isNaN(price)) {
        console.error("⛔ 유효하지 않은 가격 데이터:", price);
        return;
    }

    if (price !== lastPrice) {
        const priceElement = document.getElementById("current-price");
        if (priceElement) {
            priceElement.textContent = `${price.toLocaleString("ko-KR")} 원`;
        }
        lastPrice = price;
    }
}



// ✅ KST 시간 변환
function formatKSTTime(time) {
    const date = new Date(time * 1000);
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

// ✅ KST 툴팁 변환
function formatKSTTooltip(time) {
    const date = new Date(time * 1000);
    return date.toLocaleString("ko-KR", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
}

// ✅ 재연결 로직
function reconnectWebSocket() {
    setTimeout(() => {
        const newSocket = new SockJS("/ws");
        stompClient.connect({}, function () {
            console.log("✅ WebSocket 재연결됨");
        }, function (error) {
            console.error("❌ WebSocket 재연결 실패:", error);
        });
    }, 5000);
}

// ✅ 실행 (차트 초기화 + 과거 데이터 불러오기)
window.onload = async function () {
    initializeLightweightChart();
    candleData = await fetchHistoricalCandles(60);
    candleSeries.setData(candleData);
};
