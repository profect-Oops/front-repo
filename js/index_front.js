const socket = new SockJS("/ws");
const stompClient = Stomp.over(socket);

// 관심 있는 코인 목록
const TARGET_COINS = [
    "KRW-XRP", "KRW-BTC", "KRW-ETH", "KRW-QTUM",
    "KRW-WAVES", "KRW-XEM", "KRW-ETC", "KRW-NEO",
    "KRW-SNT", "KRW-MTL"
];

// 한글 이름 매핑 (Upbit API 호출 없이 직접 매핑)
const marketNames = {
    "KRW-XRP": { name: "엑스알피", ticker: "KRW-XRP" },
    "KRW-BTC": { name: "비트코인", ticker: "KRW-BTC" },
    "KRW-ETH": { name: "이더리움", ticker: "KRW-ETH" },
    "KRW-QTUM": { name: "퀀텀", ticker: "KRW-QTUM" },
    "KRW-WAVES": { name: "웨이브", ticker: "KRW-WAVES" },
    "KRW-XEM": { name: "넴", ticker: "KRW-XEM" },
    "KRW-ETC": { name: "이더리움 클래식", ticker: "KRW-ETC" },
    "KRW-NEO": { name: "네오", ticker: "KRW-NEO" },
    "KRW-SNT": { name: "스테이터스네트워크토큰", ticker: "KRW-SNT" },
    "KRW-MTL": { name: "메탈", ticker: "KRW-MTL" }
};

// 최초 데이터 저장용 객체 (개별 수신 즉시 화면에 반영)
const coinDataMap = {};

// WebSocket 연결 및 데이터 수신
stompClient.connect({}, function (frame) {
    console.log("✅ WebSocket 연결됨:", frame);

    // 실시간 가격 데이터 구독
    stompClient.subscribe("/topic/price", function (message) {
        const priceData = JSON.parse(message.body);

        // ✅ 관심 있는 코인만 필터링
        if (!TARGET_COINS.includes(priceData.code)) {
            return;
        }

        console.log("📥 받은 WebSocket 데이터:", priceData);

        // 데이터 저장
        coinDataMap[priceData.code] = priceData;

        // 개별 데이터가 도착할 때마다 즉시 업데이트
        //updateTable(priceData);
        // 테이블을 일정 시간마다 확인하여 업데이트 (최대 500ms 동안 재시도)
        updateTableWithRetry(priceData.code);
    });
}, function (error) {
    console.error("❌ WebSocket 연결 실패:", error);
    setTimeout(() => reconnectWebSocket(), 3000);
});

//  테이블 업데이트 함수 (최대 500ms 동안 기존 행 찾기 재시도) - 중복 방지
function updateTableWithRetry(ticker) {
    let attempts = 0;
    const maxAttempts = 10; // 10번(500ms) 재시도
    const interval = setInterval(() => {
        if (attempts >= maxAttempts) {
            clearInterval(interval);
            console.warn(`⚠️ ${ticker} 업데이트 실패: 기존 행을 찾지 못함`);
            return;
        }
        if (updateTable(ticker)) {
            clearInterval(interval);
        }
        attempts++;
    }, 50);
}

// 개별 데이터를 받아서 즉시 업데이트하는 함수
function updateTable(ticker) {
    const tableBody = document.getElementById("coin-table-body");
    const coin = coinDataMap[ticker];

    if (!coin) return false;

    let existingRow = tableBody.querySelector(`tr[data-ticker="${ticker}"]`);

    const priceChange = (coin.changeRate * 100).toFixed(2);
    const changeClass = priceChange > 0 ? "text-green-500" : priceChange < 0 ? "text-red-500" : "text-gray-500";
    const volume = coin.acc_trade_price_24h ? (coin.acc_trade_price_24h / 1e9).toFixed(1) + "억" : "-";
    const coinInfo = marketNames[ticker] || { name: ticker, ticker };
    const logo = ticker.replace("KRW-", "");

    if (existingRow) {
        // ✅ 기존 행 업데이트
        existingRow.querySelector(".price").textContent = `₩${coin.price.toLocaleString()}`;
        existingRow.querySelector(".change").textContent = `${priceChange}%`;
        existingRow.querySelector(".change").className = `change ${changeClass}`;
        existingRow.querySelector(".volume").textContent = volume;
        return true; // 업데이트 성공
    } else {
        // ✅ 새로운 코인 행 추가
        const row = document.createElement("tr");
        row.setAttribute("data-ticker", ticker);
        row.innerHTML = `
            <td><img src="https://static.upbit.com/logos/${logo}.png" alt="${coinInfo.name}"></td>
            <td>${coinInfo.name}</td>
            <td>${coinInfo.ticker}</td>
            <td class="price">₩${coin.price.toLocaleString()}</td>
            <td class="change ${changeClass}">${priceChange}%</td>
            <td class="volume">${volume}</td>
        `;

        addCoinsToServer(marketNames);

        row.style.cursor = "pointer";
        row.addEventListener('click', () => {
            const formattedName = coinInfo.name.replace(/\s+/g, "");
            window.location.href = `/coin/coinDetail.html?name=${encodeURIComponent(formattedName)}&ticker=${encodeURIComponent(coinInfo.ticker)}`;
        });

        tableBody.appendChild(row);
        return true; // 새 행 추가 성공
    }
}


// ✅ WebSocket 재연결 함수
function reconnectWebSocket() {
    console.log("🔄 WebSocket 재연결 시도...");
    setTimeout(() => {
        const newSocket = new SockJS("/ws");
        stompClient.connect({}, function () {
            console.log("✅ WebSocket 재연결됨");
        }, function (error) {
            console.error("❌ WebSocket 재연결 실패:", error);
        });
    }, 5000);
}


// 서버에 10개 코인 정보 DB insert 요청 (이미 존재하는 코인은 제외)
async function addCoinsToServer(coins) {
    try {
        // 1. 서버에 저장된 코인 목록 가져오기
        const existingCoinsResponse = await fetch('/api/coin/list');
        const existingCoins = await existingCoinsResponse.json(); // 저장된 코인 목록

        const existingTickers = new Set(existingCoins.map(coin => coin.ticker)); // 존재하는 티커 집합

        // 2. 객체를 배열로 변환하고 중복되지 않은 코인만 필터링
        const newCoins = Object.values(coins)
            .filter(coinInfo => !existingTickers.has(coinInfo.ticker)) // 중복 제외
            .map(coinInfo => ({
                ticker: coinInfo.ticker,
                name: coinInfo.name,
                picture: `https://static.upbit.com/logos/${coinInfo.ticker.replace("KRW-", "")}.png`
            }));

        if (newCoins.length === 0) {
            console.log("✅ 추가할 새로운 코인이 없습니다.");
            return;
        }

        // 3. 서버에 새로운 코인 정보 추가 요청
        const response = await fetch('/api/coin/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newCoins) // 중복되지 않은 코인만 전송
        });

        const result = await response.json(); // 응답 데이터 처리
        console.log("✅ 서버에 저장된 신규 코인:", result);

    } catch (error) {
        console.error("🚨 서버에 코인 정보를 저장하는 중 오류 발생:", error);
    }
}


