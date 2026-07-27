// Client-side TCGPlayer search & latest sales engine for standalone GitHub Pages deployment

const TCGPLAYER_SEARCH_API = "https://mp-search-api.tcgplayer.com/v1/search/request";

export function extractCardNumber(rawInput) {
  const text = rawInput.trim();
  const pattern = /([A-Za-z0-9]+[-/][0-9A-Za-z]+|\b\d{1,3}\/\d{1,3}\b)/;
  const match = text.match(pattern);
  const cardNumber = match ? match[1] : text;

  return {
    raw: text,
    extractedNumber: cardNumber
  };
}

export async function fetchRecentSalesClient(productId) {
  const url = `https://mp-search-api.tcgplayer.com/v1/product/${productId}/latestsales`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ limit: 10 })
    });

    if (res.ok) {
      const data = await res.json();
      const sales = data.data || [];
      const prices = sales
        .map(s => s.purchasePrice)
        .filter(p => p !== null && p !== undefined)
        .map(p => parseFloat(p));

      const recent3 = prices.slice(0, 3);
      const avg3 = recent3.length > 0 
        ? Math.round((recent3.reduce((a, b) => a + b, 0) / recent3.length) * 100) / 100 
        : null;

      return { recentSalesUSD: recent3, averageRecentSalesUSD: avg3 };
    }
  } catch (err) {
    console.warn(`Client-side sales fetch fallback for product ${productId}:`, err);
  }

  return { recentSalesUSD: [], averageRecentSalesUSD: null };
}

export async function searchCardClientSide(cardInput, onePieceOnly = true) {
  const cleanInput = cardInput.strip ? cardInput.strip() : cardInput.trim();
  if (!cleanInput) return [];

  const { extractedNumber: targetNum } = extractCardNumber(cleanInput);

  const categoryFilter = onePieceOnly ? { productCategoryName: ["One Piece Card Game"] } : {};

  const payloadTerm = {
    algorithm: "free_text_search",
    from: 0,
    size: 30,
    filters: {
      term: {
        number: [targetNum],
        ...categoryFilter
      }
    },
    query: "",
    context: { shippingCountry: "US", cart: {} }
  };

  let rawResults = [];
  try {
    const res = await fetch(TCGPLAYER_SEARCH_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payloadTerm)
    });

    if (res.ok) {
      const data = await res.json();
      rawResults = data.results?.[0]?.results || [];
    }

    if (rawResults.length === 0) {
      const payloadExtracted = {
        algorithm: "free_text_search",
        from: 0,
        size: 30,
        filters: { term: categoryFilter },
        query: targetNum,
        context: { shippingCountry: "US", cart: {} }
      };

      const resEx = await fetch(TCGPLAYER_SEARCH_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payloadExtracted)
      });

      if (resEx.ok) {
        const dataEx = await resEx.json();
        rawResults = dataEx.results?.[0]?.results || [];
      }
    }

    if (rawResults.length === 0 && onePieceOnly) {
      return searchCardClientSide(cardInput, false);
    }
  } catch (err) {
    console.error(`Client-side fetch error for ${cardInput}:`, err);
    return [];
  }

  const parsedVariants = [];
  const seenIds = new Set();

  for (const item of rawResults) {
    const productId = item.productId;
    if (!productId || seenIds.has(productId)) continue;

    seenIds.add(productId);
    const pId = parseInt(productId);
    const productName = item.productName || "Unknown Card";
    const setName = item.setName || "Unknown Set";
    const marketPrice = item.marketPrice !== undefined && item.marketPrice !== null ? parseFloat(item.marketPrice) : null;
    const custom = item.customAttributes || {};
    const number = custom.number || targetNum;
    const rarity = custom.rarity || "";

    const numClean = String(number).trim().toUpperCase();
    const targetClean = targetNum.trim().toUpperCase();
    const isExactNumMatch = numClean === targetClean || numClean.includes(targetClean);

    const imageUrl = `https://tcgplayer-cdn.tcgplayer.com/product/${pId}_200w.jpg`;
    const productUrl = `https://www.tcgplayer.com/product/${pId}`;

    const { recentSalesUSD, averageRecentSalesUSD } = await fetchRecentSalesClient(pId);

    const finalAvgUSD = averageRecentSalesUSD !== null ? averageRecentSalesUSD : marketPrice;

    parsedVariants.push({
      productId: pId,
      productName,
      setName,
      number,
      rarity,
      marketPriceUSD: marketPrice,
      recentSalesUSD,
      averageRecentSalesUSD: finalAvgUSD,
      imageUrl,
      productUrl,
      isExactMatch: isExactNumMatch
    });
  }

  parsedVariants.sort((a, b) => {
    if (a.isExactMatch !== b.isExactMatch) return a.isExactMatch ? -1 : 1;
    return (a.marketPriceUSD === null) - (b.marketPriceUSD === null);
  });

  return parsedVariants;
}
