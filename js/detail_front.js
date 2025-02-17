// script 태그에서 data-ticker 값 가져오기
const scriptTag = document.querySelector('script[src*="detail_front.js"]');
const market = scriptTag && scriptTag.dataset.ticker ? `${scriptTag.dataset.ticker}` : "KRW-BTC";

const socket = new SockJS("/ws");
socket.binaryType = "arraybuffer";  // 바이너리 데이터 전송으로 변경
const stompClient = Stomp.over(socket);

// 차트 관련 변수
let chart;
let candleSeries;
let candleData = [];
let tempCandle = null;
let lastCandleTimestamp = 0;
let isLoading = false;

stompClient.connect({}, function (frame) {
    console.log("WebSocket 연결됨:", frame);

    // 특정 마켓 가격 데이터만 구독
    stompClient.subscribe(`/topic/priceDetail/${market}`, function (message) {
        const startTime = performance.now(); // 시작 시간 기록
        console.log("📥 가격 데이터 수신:", message.body);
        const priceData = JSON.parse(message.body);
        updateCurrentPrice(priceData.price);
        const endTime = performance.now(); // 끝 시간 기록
        console.log(`⏱️ 데이터 처리 시간: ${(endTime - startTime).toFixed(2)}ms`);
    });

    // 특정 마켓 캔들 데이터만 구독
    stompClient.subscribe(`/topic/candle/${market}`, function (message) {
        const candleData = JSON.parse(message.body);
        processCandleData(candleData);
    });
}, function (error) {
    console.error("❌ WebSocket 연결 실패:", error);
    setTimeout(() => reconnectWebSocket(), 3000);
});

// 차트 초기화
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

    // 차트 스크롤 이벤트 감지 → 과거 데이터 로드
    chart.timeScale().subscribeVisibleTimeRangeChange((timeRange) => {
        if (!timeRange) return;

        const firstCandleTime = candleData.length > 0 ? candleData[0].time : null;

        console.log(`⏳ 현재 차트 범위: from=${timeRange.from}, to=${timeRange.to}`);
        console.log(`🔍 첫 번째 캔들 시간: ${firstCandleTime}`);

        if (firstCandleTime && timeRange.from < firstCandleTime + 120) { // 60초 → 120초로 확장
            console.log("📥 과거 데이터 로드 트리거됨...");
            loadMoreHistoricalCandles();
        }
    });
}

// 과거 데이터 불러오기 (레디스 → Upbit API 요청)
async function loadMoreHistoricalCandles() {
    if (isLoading || candleData.length === 0) {
        console.warn("⚠️ 데이터가 없거나, 이미 로딩 중입니다.");
        return;
    }
    isLoading = true;

    // 가장 오래된 캔들의 timestamp를 `to` 값으로 설정
    const oldestCandle = candleData[0];
    if (!oldestCandle || !oldestCandle.time) {
        console.error("🚨 candleData에 유효한 데이터가 없습니다.");
        isLoading = false;
        return;
    }

    const toDate = new Date(oldestCandle.time * 1000).toISOString().split(".")[0]; // `to` 값 변환

    console.log(`📅 과거 데이터 요청 시간: ${toDate}`);

    // `to` 값을 포함하여 요청
    const historicalCandles = await fetchHistoricalCandlesFromServer(30, toDate);

    if (!historicalCandles || historicalCandles.length === 0) {
        console.warn("⚠️ 추가적인 과거 데이터를 가져오지 못했습니다.");
        isLoading = false;
        return;
    }

    console.log("📥 불러온 과거 캔들 데이터:", historicalCandles);

    // 🚨 불러온 데이터가 현재 데이터보다 미래인지 확인 후 제거
    if (historicalCandles[historicalCandles.length - 1].time >= candleData[0].time) {
        console.warn("⚠️ 과거 데이터가 최신 데이터보다 미래일 수 없음, 데이터 삭제:", historicalCandles);
        historicalCandles.pop(); // 최신 데이터 제거
    }

    // 기존 데이터와 새 데이터 병합 (중복 제거)
    candleData = removeDuplicateCandles([...historicalCandles, ...candleData]);

    // 새로운 `toDate` 갱신 (다음 요청 시 사용)
    console.log(`📅 새롭게 갱신된 toDate: ${new Date(candleData[0].time * 1000).toISOString().split(".")[0]}`);

    // 차트 업데이트
    if (candleData.length > 0) {
        console.log("📊 차트 업데이트 실행");
        candleSeries.setData(candleData);
    } else {
        console.warn("⚠️ 병합 후 추가적인 과거 데이터가 없습니다.");
    }

    isLoading = false;
}



// Redis에서 과거 캔들 데이터를 가져오기 (서버 요청)
async function fetchHistoricalCandlesFromServer(count = 120, to = null) {
    let url = `/api/redis/candles/${market}?count=${count}`;
    if (to) {
        url += `&to=${encodeURIComponent(to)}`;  // ✅ `to` 값 RequestParam으로 추가
    }

    try {
        const response = await fetch(url, { method: "GET" });
        if (!response.ok) {
            console.error(`🚨 HTTP 오류! 상태 코드: ${response.status}`);
            return [];
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            console.warn("⚠️ 서버에서 가져온 데이터가 배열이 아니거나 비어 있음.");
            return [];
        }

        const candles = data
            .map(candle => ({
                time: Math.floor(candle.timestamp / 1000),  // 초 단위 변환
                open: candle.opening_price ?? null,
                high: candle.high_price ?? null,
                low: candle.low_price ?? null,
                close: candle.trade_price ?? null,
            }))
            .filter(candle => candle.time !== null && candle.open !== null && candle.close !== null)
            .sort((a, b) => a.time - b.time); // 시간 정렬

        return removeDuplicateCandles(candles);
    } catch (error) {
        console.error("❌ 서버에서 과거 캔들 데이터를 가져오는 중 오류 발생:", error);
        return [];
    }
}


// 중복 타임스탬프 제거 함수
function removeDuplicateCandles(candles) {
    const uniqueMap = new Map();

    candles.forEach(candle => {
        // 기존 값과 중복된 값이 아니라면 추가
        if (!uniqueMap.has(candle.time)) {
            uniqueMap.set(candle.time, candle);
        }
    });
    return Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
}

// 캔들 데이터 반영
function processCandleData(candle) {
    const timestamp = Math.floor(candle.timestamp / 1000);
    const minuteTimestamp = timestamp - (timestamp % 60);

    if (!candle.opening_price || !candle.high_price || !candle.low_price || !candle.trade_price) {
        console.warn("⚠️ 유효하지 않은 캔들 데이터 수신:", candle);
        return;
    }

    // 중복 방지: 이미 존재하는 타임스탬프면 업데이트만 수행
    const existingIndex = candleData.findIndex(c => c.time === minuteTimestamp);
    if (existingIndex !== -1) {
        candleData[existingIndex] = {
            time: minuteTimestamp,
            open: candle.opening_price,
            high: candle.high_price,
            low: candle.low_price,
            close: candle.trade_price,
        };
        candleSeries.update(candleData[existingIndex]);
        return;
    }

    // 과거 데이터보다 더 미래 데이터를 추가하려고 하면 방지
    if (candleData.length > 0 && minuteTimestamp <= candleData[candleData.length - 1].time) {
        console.warn("⚠️ 과거 데이터가 최신 데이터보다 미래에 위치할 수 없음:", candle);
        return;
    }

    if (!tempCandle || minuteTimestamp > lastCandleTimestamp) {
        if (tempCandle) {
            candleData.push(tempCandle);
            candleData = removeDuplicateCandles(candleData);
            candleSeries.setData(candleData);
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

// 현재 가격 업데이트
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



// KST 시간 변환
function formatKSTTime(time) {
    const date = new Date(time * 1000);
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

// KST 툴팁 변환
function formatKSTTooltip(time) {
    const date = new Date(time * 1000);
    return date.toLocaleString("ko-KR", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
}

// 재연결 로직
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

// 실행 (차트 초기화 + 과거 데이터 불러오기)
window.onload = async function () {
    initializeLightweightChart();

    // 초기 데이터 가져오기 전에 빈 배열이 아닐지 확인
    const initialCandles = await fetchHistoricalCandlesFromServer(120);
    if (initialCandles.length > 0) {
        candleData = removeDuplicateCandles(initialCandles);
        candleSeries.setData(candleData);
    } else {
        console.warn("⚠️ 초기 캔들 데이터를 불러오지 못했습니다.");
    }
};
