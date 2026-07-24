export function detectSearchIntent(query, requestedCategory = "web") {
  const lower = query.toLowerCase();
  const hasIndicScript = /[\u0900-\u097f\u0600-\u06ff]/.test(query);
  const hasBharatTerms =
    hasIndicScript ||
    /\b(itr|tax|aadhaar|aadhar|pan|upi|digilocker|gst|sarkari|ration|pf|epfo|irctc|paytm|phonepe|gpay|bharat|india)\b/.test(
      lower,
    );

  if (requestedCategory === "tech" || /\b(code|typescript|react|node|api|bug|error|sdk|library|github|npm)\b/.test(lower)) {
    return {
      intent: "code",
      vertical: "developer",
      searchQuery: `${query} official docs github`,
      preferredSources: ["official", "documentation", "github"],
    };
  }

  if (/\b(ipl|cricket|score|points table|standings|match|qualifier|playoff)\b/.test(lower)) {
    return {
      intent: "sports",
      vertical: "sports",
      searchQuery: `${query} official latest standings`,
      preferredSources: ["official", "major_media"],
    };
  }

  if (requestedCategory === "news" || /\b(today|latest|breaking|news|update|live)\b/.test(lower)) {
    return {
      intent: "news",
      vertical: "news",
      searchQuery: `${query} latest India`,
      preferredSources: ["major_media", "official"],
    };
  }

  const hasCommerceShape =
    /\b(under rs|under inr|under rupees|under \u20b9|price|buy|best phone|best mobile|deal|compare|comparison)\b/.test(lower) ||
    (/\b(phones?|mobiles?|laptops?|earbuds|tvs?|cameras?|watches)\b/.test(lower) &&
      /\bunder\s+(rs\s*)?\d{3,6}\b/.test(lower));

  if (hasCommerceShape) {
    const normalized = query.replace(/₹/g, "Rs ").replace(/,/g, "");
    const isPhoneQuery = /\b(5g|phone|phones|mobile|mobiles|smartphone|smartphones)\b/i.test(query);
    const budgetMatch = normalized.match(/\b(?:under|below|upto|up to)\s*(?:rs|inr|rupees)?\s*(\d{4,6})\b/i);
    const budget = budgetMatch?.[1] || (/\b20\s?000\b/.test(normalized) ? "20000" : "");
    const baseCommerceQuery =
      isPhoneQuery && budget
        ? `best 5g phones under ${budget} India 2026`
        : `${query} India price comparison`;

    return {
      intent: "commerce",
      vertical: "commerce",
      productCategory: isPhoneQuery ? "smartphones" : "shopping",
      budget,
      searchQuery: baseCommerceQuery,
      searchQueries: isPhoneQuery
        ? [
            baseCommerceQuery,
            `91mobiles best 5g phones under ${budget || "20000"} India`,
            `smartprix 5g phones under ${budget || "20000"} India`,
            `gadgets360 best phones under ${budget || "20000"} India 5g`,
            `gsmarena best 5g phone under ${budget || "20000"} India`,
            `best camera gaming battery phone under ${budget || "20000"} India`,
          ]
        : [`${query} India price comparison`, `${query} reviews India`, `${query} buy India`],
      requiredTerms: isPhoneQuery ? ["phone", "mobile", "smartphone", "5g"] : [],
      preferredSources: ["commerce_review", "marketplace", "major_media", "official", "web"],
    };
  }

  if (hasBharatTerms || requestedCategory === "bharat") {
    return {
      intent: "bharat",
      vertical: "india",
      searchQuery: `${query} India official`,
      preferredSources: ["government", "official", "major_media"],
    };
  }

  if (requestedCategory === "research") {
    return {
      intent: "research",
      vertical: "research",
      searchQuery: `${query} research sources`,
      preferredSources: ["official", "major_media", "web"],
    };
  }

  return {
    intent: requestedCategory || "web",
    vertical: "web",
    searchQuery: query,
    preferredSources: ["official", "major_media", "web"],
  };
}
