const API_URL = "https://api.upbit.com/v1/ticker?markets=";
const MARKET_URL = "https://api.upbit.com/v1/market/all";

// 한글 이름을 저장할 객체
let marketNames = {};

// Upbit API에서 모든 마켓 정보 가져오기 (이름 매핑)
async function fetchMarketNames() {
    try {
        const marketResponse = await fetch(MARKET_URL);
        const markets = await marketResponse.json();

        // KRW 마켓 필터링 및 이름 저장
        marketNames = markets
            .filter(market => market.market.startsWith("KRW-"))
            .reduce((acc, market) => {
                acc[market.market] = {
                    name: market.korean_name, // 한글 이름
                    ticker: market.market.replace("KRW-", "") // 티커 (KRW- 제거)
                };
                return acc;
            }, {});
    } catch (error) {
        console.error("마켓 정보를 가져오는 중 오류 발생:", error);
    }
}

// Upbit API에서 코인을 가져오는 함수
async function fetchTopCoins() {
    try {
        if (Object.keys(marketNames).length === 0) {
            await fetchMarketNames(); // 마켓 정보가 없으면 먼저 가져옴
        }

        // KRW 마켓 코드만 가져오기
        const krwMarkets = Object.keys(marketNames).slice(0, 10); // 상위 10개
        const tickers = krwMarkets.join(",");
        const tickerResponse = await fetch(API_URL + tickers);
        const tickerData = await tickerResponse.json();

        // 거래량 기준으로 정렬하여 상위 10개 선택 -> 사용 안함
        const topCoins = tickerData
            .sort((a, b) => b.acc_trade_price_24h - a.acc_trade_price_24h) // 거래량 내림차순 정렬
            .slice(0, 10); // 상위 10개 선택

        // 서버에 상위 10개 코인 정보 추가 요청
        await addCoinsToServer(tickerData);  // 이 부분 추가

        // 테이블 업데이트
        updateTable(tickerData);

    } catch (error) {
        console.error("코인 데이터를 가져오는 중 오류 발생:", error);
    }
}

// 테이블에 데이터 삽입하는 함수
function updateTable(coins) {
    const tableBody = document.getElementById("coin-table-body");
    tableBody.innerHTML = ""; // 기존 데이터 삭제

    coins.forEach(coin => {
        const row = document.createElement("tr");
        const priceChange = (coin.signed_change_rate * 100).toFixed(2);
        const volume = (coin.acc_trade_price_24h / 1e9).toFixed(1) + "억";

        // 가격 변동률의 색상 적용을 위한 class 설정
        const changeClass = priceChange > 0 ? "text-green-500" : priceChange < 0 ? "text-red-500" : "text-gray-500";

        // 코인의 한글 이름 & 티커 가져오기 (예: KRW-BTC -> 비트코인, BTC)
        const coinInfo = marketNames[coin.market] || { name: coin.market, ticker: coin.market.replace("KRW-", "") };

        row.innerHTML = `
            <td><img src="https://static.upbit.com/logos/${coinInfo.ticker}.png" alt="${coinInfo.name}"></td>
            <td>${coinInfo.name}</td> <!-- 한글 이름 표시 -->
            <td>${coinInfo.ticker}</td> <!-- KRW- 제거한 티커 표시 -->
            <td>₩${coin.trade_price.toLocaleString()}</td>
            <td class="${changeClass}">${priceChange}%</td>
            <td>${volume}</td>
        `;

        // 클릭 시 상세 페이지로 이동
        row.style.cursor = "pointer"; // 마우스 오버 시 손가락 모양
        row.addEventListener('click', () => {
            window.location.href = `/coin/coinDetail.html?name=${encodeURIComponent(coinInfo.name)}&ticker=${encodeURIComponent(coinInfo.ticker)}`;
        });
        tableBody.appendChild(row);
    });
}

// 서버에 상위 10개 코인 정보 추가 요청
async function addCoinsToServer(coins) {
    try {
        const coinInfoArray = coins.map(coin => {
            // 필요한 정보를 담은 객체를 생성
            const coinInfo = marketNames[coin.market] || { name: coin.market, ticker: coin.market.replace("KRW-", "") };
            return {
                ticker: coinInfo.ticker,
                name: coinInfo.name,
                picture: `https://static.upbit.com/logos/${coinInfo.ticker}.png`
            };
        });

        // 서버에 POST 요청으로 데이터 전송
        const response = await fetch('/api/coin/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(coinInfoArray) // 배열을 JSON 형식으로 서버로 전송
        });

        const result = await response.json(); // 응답 받은 데이터 처리
        console.log("서버에 저장된 코인:", result);

    } catch (error) {
        console.error("서버에 코인 정보를 저장하는 중 오류 발생:", error);
    }
}

// 최초 실행
fetchTopCoins();
setInterval(fetchTopCoins, 60000); // 1분마다 업데이트