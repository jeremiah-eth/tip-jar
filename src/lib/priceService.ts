// Simple price service using CoinGecko public API
// Note: Public API has rate limits (approx 10-30 calls/min).

const COINGECKO_API_URL = "https://api.coingecko.com/api/v3/simple/price";

export interface CoinPrices {
    ethereum?: { usd: number };
    solana?: { usd: number };
    "usd-coin"?: { usd: number };
}

// Cache to prevent hitting rate limits too often
let priceCache: { data: CoinPrices; timestamp: number } | null = null;
const CACHE_DURATION_MS = 60 * 1000; // 1 minute cache

export const fetchCryptoPrices = async (): Promise<CoinPrices | null> => {
    // Check cache
    const now = Date.now();
    if (priceCache && now - priceCache.timestamp < CACHE_DURATION_MS) {
        return priceCache.data;
    }

    try {
        const params = new URLSearchParams({
            ids: "ethereum,solana,usd-coin",
            vs_currencies: "usd",
        });

        const response = await fetch(`${COINGECKO_API_URL}?${params}`);

        if (!response.ok) {
            console.error("Failed to fetch prices:", response.statusText);
            return null;
        }

        const data = await response.json();

        // Update cache
        priceCache = {
            data: data,
            timestamp: now,
        };

        return data;
    } catch (error) {
        console.error("Error fetching crypto prices:", error);
        return null;
    }
};
