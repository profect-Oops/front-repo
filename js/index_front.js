const socket = new SockJS("/ws");
const stompClient = Stomp.over(socket);

// ✅ 관심 있는 코인 목록 (여기에 없는 코인은 무시)
const TARGET_COINS = [
    "KRW-XRP", "KRW-BTC", "KRW-ETH", "KRW-QTUM",
    "KRW-WAVES", "KRW-XEM", "KRW-ETC", "KRW-NEO",
    "KRW-SNT", "KRW-MTL"
];

// ✅ 한글 이름 매핑 (Upbit API 호출 없이 직접 매핑)
const marketNames = {
    "KRW-XRP": { name: "엑스알피", ticker: "XRP" },
    "KRW-BTC": { name: "비트코인", ticker: "BTC" },
    "KRW-ETH": { name: "이더리움", ticker: "ETH" },
    "KRW-QTUM": { name: "퀀텀", ticker: "QTUM" },
    "KRW-WAVES": { name: "웨이브", ticker: "WAVES" },
    "KRW-XEM": { name: "넴", ticker: "XEM" },
    "KRW-ETC": { name: "이더리움 클래식", ticker: "ETC" },
    "KRW-NEO": { name: "네오", ticker: "NEO" },
    "KRW-SNT": { name: "스테이터스네트워크토큰", ticker: "SNT" },
    "KRW-MTL": { name: "메탈", ticker: "MTL" }
};

// ✅ 최초 데이터 저장용 객체 (개별 수신 즉시 화면에 반영)
const coinDataMap = {};

// ✅ WebSocket 연결 및 데이터 수신
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

        // ✅ 데이터 저장
        coinDataMap[priceData.code] = priceData;

        // ✅ 개별 데이터가 도착할 때마다 즉시 업데이트
        updateTable(priceData);
    });

}, function (error) {
    console.error("❌ WebSocket 연결 실패:", error);
    setTimeout(() => reconnectWebSocket(), 3000);
});

// ✅ 개별 데이터를 받아서 즉시 업데이트하는 함수
function updateTable(coin) {
    const tableBody = document.getElementById("coin-table-body");
    const existingRows = Array.from(tableBody.getElementsByTagName("tr"));
    const ticker = coin.code.replace("KRW-", ""); // 티커 추출
    const existingRow = existingRows.find(row => row.dataset.ticker === ticker);

    const priceChange = (coin.changeRate * 100).toFixed(2);
    const changeClass = priceChange > 0 ? "text-green-500" : priceChange < 0 ? "text-red-500" : "text-gray-500";
    const volume = coin.acc_trade_price_24h ? (coin.acc_trade_price_24h / 1e9).toFixed(1) + "억" : "-";

    // ✅ marketNames에서 한글 이름과 티커 가져오기
    const coinInfo = marketNames[coin.code] || { name: coin.code, ticker };

    if (existingRow) {
        // ✅ 기존 행 업데이트 (가격, 변동률, 거래량 갱신)
        existingRow.children[3].textContent = `₩${coin.price.toLocaleString()}`;
        existingRow.children[4].textContent = `${priceChange}%`;
        existingRow.children[4].className = changeClass;
        existingRow.children[5].textContent = volume;
    } else {
        // ✅ 새로운 코인 추가
        const row = document.createElement("tr");
        row.dataset.ticker = ticker; // 중복 방지를 위해 티커 저장

        row.innerHTML = `
            <td><img src="https://static.upbit.com/logos/${ticker}.png" alt="${coinInfo.name}"></td>
            <td>${coinInfo.name}</td>
            <td>${coinInfo.ticker}</td>
            <td>₩${coin.price.toLocaleString()}</td>
            <td class="${changeClass}">${priceChange}%</td>
            <td>${volume}</td>
        `;

        // 클릭 시 상세 페이지로 이동
        row.style.cursor = "pointer";
        row.addEventListener('click', () => {
            const formattedName = coinInfo.name.replace(/\s+/g, "");
            window.location.href = `/coin/coinDetail.html?name=${encodeURIComponent(formattedName)}&ticker=${encodeURIComponent(coinInfo.ticker)}`;
        });

        tableBody.appendChild(row);
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
