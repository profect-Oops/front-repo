const coins = [
    {
        id: 'bitcoin',
        name: '비트코인',
        ticker: 'BTC',
        logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
        price: '₩58,432,000',
        priceChange: 2.5,
        volume: '₩5.2조'
    },
    {
        id: 'ethereum',
        name: '이더리움',
        ticker: 'ETH',
        logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
        price: '₩3,421,000',
        priceChange: -1.2,
        volume: '₩2.8조'
    },
    {
        id: 'binance',
        name: '바이낸스코인',
        ticker: 'BNB',
        logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
        price: '₩432,000',
        priceChange: 0.8,
        volume: '₩1.5조'
    },
    {
        id: 'ripple',
        name: '리플',
        ticker: 'XRP',
        logo: 'https://cryptologos.cc/logos/xrp-xrp-logo.png',
        price: '₩780',
        priceChange: 3.2,
        volume: '₩8,900억'
    },
    {
        id: 'cardano',
        name: '카르다노',
        ticker: 'ADA',
        logo: 'https://cryptologos.cc/logos/cardano-ada-logo.png',
        price: '₩890',
        priceChange: -2.1,
        volume: '₩7,200억'
    },
    {
        id: 'bitcoin',
        name: '비트코인',
        ticker: 'BTC',
        logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
        price: '₩58,432,000',
        priceChange: 2.5,
        volume: '₩5.2조'
    },
    {
        id: 'ethereum',
        name: '이더리움',
        ticker: 'ETH',
        logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
        price: '₩3,421,000',
        priceChange: -1.2,
        volume: '₩2.8조'
    },
    {
        id: 'binance',
        name: '바이낸스코인',
        ticker: 'BNB',
        logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
        price: '₩432,000',
        priceChange: 0.8,
        volume: '₩1.5조'
    },
    {
        id: 'ripple',
        name: '리플',
        ticker: 'XRP',
        logo: 'https://cryptologos.cc/logos/xrp-xrp-logo.png',
        price: '₩780',
        priceChange: 3.2,
        volume: '₩8,900억'
    },
    {
        id: 'cardano',
        name: '카르다노',
        ticker: 'ADA',
        logo: 'https://cryptologos.cc/logos/cardano-ada-logo.png',
        price: '₩890',
        priceChange: -2.1,
        volume: '₩7,200억'
    }
];

function createCoinRow(coin) {
    const row = document.createElement('tr');
    row.onclick = () => window.location.href = `detail.html?id=${coin.id}`;

    row.innerHTML = `
        <td><img src="${coin.logo}" alt="${coin.name}" class="coin-logo"></td>
        <td>${coin.name}</td>
        <td>${coin.ticker}</td>
        <td>${coin.price}</td>
        <td class="price-change ${coin.priceChange >= 0 ? 'positive' : 'negative'}">${coin.priceChange}%</td>
        <td>${coin.volume}</td>
    `;

    return row;
}

// 테이블 바디에 코인 데이터를 추가
const tableBody = document.getElementById('coin-table-body');
coins.forEach(coin => {
    tableBody.appendChild(createCoinRow(coin));
});
